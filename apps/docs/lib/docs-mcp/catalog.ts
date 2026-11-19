import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Heading, Node, Root } from 'mdast';
import { DOCS_ORIGIN } from '../origin';
import { exampleOf } from '../exampleCode';
import { parseMdx } from '../mdxAst';
import { pageSummary } from '../pageSummary.mjs';
import { defaultImports, exampleBlocks, exampleFile, exampleLocalModules, EXAMPLES_DIR } from '../remarkExamples.mjs';
import { absolutize, loadPages } from './mdx';
import { headingAnchor, tokensOf } from './units';

export type LocaleId = 'en';

export type ExampleFile = {
  id: string;
  file: string;
  path: string;
  lang: string;
  demonstrates: string;
  anchor: string;
  lines: number;
  tokens: number;
  text: string;
};

export type SectionRecord = {
  anchor: string;
  heading: string;
  depth: 2 | 3;
  markdown: string;
  tokens: number;
  examples: ExampleFile[];
};

export type PageRecord = {
  locale: LocaleId;
  slug: string;
  title: string;
  file: string;
  docsUrl: string;
  props: string[];
  intro: string;
  markdown: string;
  sections: SectionRecord[];
  examples: ExampleFile[];
  tokens: number;
  /** Example source and fenced code, so a recipe can name the exports it uses without pasting them into the reply. */
  code: string;
  description: string | null;
};

type HeadingMark = { anchor: string; text: string; depth: 2 | 3; from: number };

const APP_EN = join(process.cwd(), 'app', '(en)');
const APP_KO = join(process.cwd(), 'app', 'ko');

function plain(node: Node): string {
  if ((node.type === 'text' || node.type === 'inlineCode') && 'value' in node && typeof node.value === 'string') return node.value;
  if (!('children' in node) || !Array.isArray(node.children)) return '';
  return node.children.map(plain).join('');
}

/** An explicit `{/* #id *\/}` on a heading, the same form the docs page accepts. */
function explicitId(node: Heading): string | null {
  const last = node.children.at(-1);
  if (!last || last.type !== 'mdxTextExpression' || !('value' in last) || typeof last.value !== 'string') return null;
  const comment = /^\s*\/\*([\s\S]*?)\*\/\s*$/.exec(last.value);
  const body = comment?.[1]?.trim();
  if (!body) return null;
  if (!body.startsWith('#')) return null;
  const id = /^#([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(body)?.[1];
  return id ?? null;
}

function headingsOf(tree: Root): HeadingMark[] {
  const seen = new Set<string>();
  const marks: HeadingMark[] = [];
  for (const node of tree.children) {
    if (node.type !== 'heading' || (node.depth !== 2 && node.depth !== 3)) continue;
    const text = plain(node).replace(/\s+/g, ' ').trim();
    const declared = explicitId(node);
    const anchor = declared ?? headingAnchor(text, seen);
    if (declared) {
      if (seen.has(declared)) throw new Error(`Heading "${text}" asks for #${declared}, which an earlier heading already uses`);
      seen.add(declared);
    }
    marks.push({ anchor, text, depth: node.depth, from: node.position!.start.offset! });
  }
  return marks;
}

function fenceCode(markdown: string): string {
  return [...markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((hit) => hit[1] ?? '').join('\n');
}

function stubText(slug: string, files: ExampleFile[]): string {
  return files
    .map((file) => {
      const about = file.demonstrates ? ` It demonstrates "${file.demonstrates}".` : '';
      return `Example \`${file.file}\` (${file.lines} lines, ${file.tokens} tokens).${about} Fetch it with get_example, page "${slug}", file "${file.file}".`;
    })
    .join('\n\n');
}

function exampleRow(path: string, lang: string, value: string, id: string, demonstrates: string, anchor: string): ExampleFile {
  return {
    id,
    file: basename(path),
    path: path.slice(EXAMPLES_DIR.length),
    lang,
    demonstrates,
    anchor,
    lines: value.split('\n').length,
    tokens: tokensOf(value.length),
    text: value,
  };
}

function filesFor(file: string, id: string, demonstrates: string, anchor: string, shown: Set<string>): ExampleFile[] {
  const text = readFileSync(file, 'utf8');
  // The page renders the tsx and the stylesheets only. A sibling module is listed for get_example.
  // Each stylesheet block carries its path, so two imports cannot swap contents by position.
  const blocks = exampleBlocks(file, shown);
  const tsx = blocks.find((block) => block.lang === 'tsx');
  return [
    exampleRow(file, tsx?.lang ?? 'tsx', tsx?.value ?? '', id, demonstrates, anchor),
    ...exampleLocalModules(file, text).map((path) => exampleRow(path, 'ts', readFileSync(path, 'utf8').trimEnd(), id, demonstrates, anchor)),
    ...blocks.filter((block) => block.lang === 'css').map((block) => exampleRow(block.path, block.lang, block.value, id, demonstrates, anchor)),
  ];
}

function compile(slug: string, raw: string, file = join(APP_EN, slug, 'page.mdx')): PageRecord {
  const tree = parseMdx(raw);
  const title = raw.split('\n').find((line) => line.startsWith('# '))?.slice(2) ?? slug;
  const props = [...raw.matchAll(/<PropsTable\s+name="([^"]+)"\s*\/>/g)].map((hit) => hit[1] ?? '');
  const marks = headingsOf(tree);
  const imports = defaultImports(tree);
  const shown = new Set<string>();
  const examples: ExampleFile[] = [];
  const replacements: { from: number; to: number; text: string }[] = [];
  let heading = title;
  let anchor = '';
  for (const node of tree.children) {
    if (node.type === 'heading' && (node.depth === 2 || node.depth === 3)) {
      const mark = marks.find((item) => item.from === node.position!.start.offset!);
      if (mark) {
        heading = mark.text;
        anchor = mark.anchor;
      }
    }
    const name = exampleOf(node);
    if (!name) continue;
    const exampleFilePath = exampleFile(file, imports, name);
    const files = filesFor(exampleFilePath, name, heading, anchor, shown);
    examples.push(...files);
    replacements.push({
      from: node.position!.start.offset!,
      to: node.position!.end.offset!,
      text: stubText(slug, files),
    });
  }
  const markdown = applySlice(raw, 0, raw.length, replacements);
  const { intro, sections } = splitSections(raw, marks, examples, replacements);
  const description = pageSummary(tree, Infinity)?.description || null;
  return {
    locale: 'en',
    slug,
    title,
    file,
    docsUrl: `${DOCS_ORIGIN}/${slug}`,
    props,
    intro,
    markdown,
    sections,
    examples,
    tokens: tokensOf(markdown.length),
    code: [...examples.map((item) => item.text), fenceCode(raw)].filter(Boolean).join('\n'),
    description,
  };
}

/** Drops top-level import and export lines. Lines inside a fence stay, since those are the example. */
function stripModuleLines(markdown: string): string {
  let fence = false;
  return markdown
    .split('\n')
    .filter((line) => {
      if (line.startsWith('```')) {
        fence = !fence;
        return true;
      }
      if (fence) return true;
      return !/^\s*(import|export)\b/.test(line);
    })
    .join('\n');
}

type Replacement = { from: number; to: number; text: string };

/** A slice of the raw page, with example stubs and absolute links, bounded by a heading node's offset. */
function applySlice(raw: string, start: number, end: number, replacements: Replacement[]): string {
  let text = raw.slice(start, end);
  const local = replacements
    .filter((item) => item.from >= start && item.to <= end)
    .map((item) => ({ from: item.from - start, to: item.to - start, text: item.text }))
    .sort((a, b) => b.from - a.from);
  for (const item of local) text = text.slice(0, item.from) + item.text + text.slice(item.to);
  return stripModuleLines(absolutize(text));
}

function splitSections(
  raw: string,
  marks: HeadingMark[],
  examples: ExampleFile[],
  replacements: Replacement[],
): { intro: string; sections: SectionRecord[] } {
  const firstH2 = marks.find((mark) => mark.depth === 2);
  const intro = applySlice(raw, 0, firstH2?.from ?? raw.length, replacements).trim();
  const sections = marks.map((mark, index) => {
    const next = marks.slice(index + 1).find((other) => other.depth <= mark.depth);
    const body = applySlice(raw, mark.from, next?.from ?? raw.length, replacements).trim();
    return {
      anchor: mark.anchor,
      heading: mark.text,
      depth: mark.depth,
      markdown: body,
      tokens: tokensOf(body.length),
      examples: examples.filter((example) => example.anchor === mark.anchor),
    };
  });
  return { intro, sections };
}

let cached: PageRecord[] | null = null;

const FIXTURE_PAGES = join(process.cwd(), 'lib', 'docs-mcp', 'fixtures', 'pages');

function build(): PageRecord[] {
  const pages: PageRecord[] = [];
  for (const page of loadPages(APP_EN, { inlineExamples: false })) {
    pages.push(compile(page.slug, page.markdown));
  }
  // A route test sets this so a page that is not part of the site can be fetched.
  if (process.env.TODAE_DOCS_MCP_FIXTURE === '1') {
    for (const page of loadPages(FIXTURE_PAGES, { inlineExamples: false })) {
      pages.push(compile(page.slug, page.markdown, join(FIXTURE_PAGES, page.slug, 'page.mdx')));
    }
  }
  return pages;
}

export function allPages(): readonly PageRecord[] {
  cached ??= build();
  return cached;
}

/** Drops the cached pages so a test can load the fixture directory. */
export function resetPagesForTests(): void {
  cached = null;
}

/**
 * Heading anchors on the Korean twin, in the same order as the English page.
 * Null when that file is missing or cannot be read. The search index stays English.
 */
export function koreanSectionAnchors(slug: string): string[] | null {
  if (!slug || slug.split('/').some((part) => part === '' || part === '.' || part === '..')) return null;
  const file = join(APP_KO, slug, 'page.mdx');
  if (!existsSync(file)) return null;
  try {
    return headingsOf(parseMdx(readFileSync(file, 'utf8'))).map((mark) => mark.anchor);
  } catch {
    return null;
  }
}
