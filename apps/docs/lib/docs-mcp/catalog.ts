import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Heading, Node, Root } from 'mdast';
import { DOCS_ORIGIN } from '../origin';
import { exampleOf } from '../exampleCode';
import { parseMdx } from '../mdxAst';
import { pageSummary } from '../pageSummary.mjs';
import { defaultImports, exampleBlocks, exampleFile, exampleStylesheets, EXAMPLES_DIR } from '../remarkExamples.mjs';
import { exampleSource } from '../exampleSource.mjs';
import { absolutize, loadPages } from './mdx';
import { headingAnchor, tokensOf } from './units';

export type LocaleId = 'en' | 'ko';

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

const APP: Record<LocaleId, string> = {
  en: join(process.cwd(), 'app', '(en)'),
  ko: join(process.cwd(), 'app', 'ko'),
};

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

function filesFor(file: string, id: string, demonstrates: string, anchor: string, shown: Set<string>): ExampleFile[] {
  const source = readFileSync(file, 'utf8');
  const before = new Set(shown);
  const blocks = exampleBlocks(file, shown);
  const sheets = exampleStylesheets(file, source).filter((path) => !before.has(path));
  const tsx = exampleSource(source);
  const made: ExampleFile[] = [
    {
      id,
      file: basename(file),
      path: file.slice(EXAMPLES_DIR.length),
      lang: 'tsx',
      demonstrates,
      anchor,
      lines: tsx.split('\n').length,
      tokens: tokensOf(tsx.length),
      text: tsx,
    },
  ];
  sheets.forEach((path, index) => {
    const text = blocks[index + 1]?.value ?? '';
    made.push({
      id,
      file: basename(path),
      path: path.slice(EXAMPLES_DIR.length),
      lang: 'css',
      demonstrates,
      anchor,
      lines: text.split('\n').length,
      tokens: tokensOf(text.length),
      text,
    });
  });
  return made;
}

function compile(locale: LocaleId, slug: string, raw: string): PageRecord {
  const file = join(APP[locale], slug, 'page.mdx');
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
  let markdown = raw;
  for (const replacement of replacements.sort((a, b) => b.from - a.from)) {
    markdown = markdown.slice(0, replacement.from) + replacement.text + markdown.slice(replacement.to);
  }
  markdown = absolutize(markdown);
  const { intro, sections } = splitSections(markdown, marks, examples);
  const description = pageSummary(tree, Infinity)?.description || null;
  return {
    locale,
    slug,
    title,
    file,
    docsUrl: locale === 'ko' ? `${DOCS_ORIGIN}/ko/${slug}` : `${DOCS_ORIGIN}/${slug}`,
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

function findHeading(markdown: string, mark: HeadingMark, from: number): number {
  const line = `${'#'.repeat(mark.depth)} ${mark.text}`;
  let index = markdown.indexOf(line, from);
  while (index >= 0) {
    const after = markdown[index + line.length];
    if (after === undefined || after === '\n' || after === '\r' || after === ' ') return index;
    index = markdown.indexOf(line, index + line.length);
  }
  return -1;
}

function splitSections(
  markdown: string,
  marks: HeadingMark[],
  examples: ExampleFile[],
): { intro: string; sections: SectionRecord[] } {
  const found: { index: number; mark: HeadingMark }[] = [];
  let from = 0;
  for (const mark of marks) {
    const index = findHeading(markdown, mark, from);
    if (index < 0) continue;
    found.push({ index, mark });
    from = index + 1;
  }
  const firstH2 = found.find((item) => item.mark.depth === 2);
  const intro = markdown.slice(0, firstH2?.index ?? markdown.length).trim();
  const sections = found.map((item, index) => {
    const next = found.slice(index + 1).find((other) => other.mark.depth <= item.mark.depth);
    const body = markdown.slice(item.index, next?.index ?? markdown.length).trim();
    return {
      anchor: item.mark.anchor,
      heading: item.mark.text,
      depth: item.mark.depth,
      markdown: body,
      tokens: tokensOf(body.length),
      examples: examples.filter((example) => example.anchor === item.mark.anchor),
    };
  });
  return { intro, sections };
}

let cached: PageRecord[] | null = null;

function build(): PageRecord[] {
  const pages: PageRecord[] = [];
  for (const locale of ['en', 'ko'] as const) {
    for (const page of loadPages(APP[locale], { inlineExamples: false })) {
      pages.push(compile(locale, page.slug, page.markdown));
    }
  }
  return pages;
}

export function allPages(): readonly PageRecord[] {
  cached ??= build();
  return cached;
}

export function pageRecord(locale: LocaleId, slug: string): PageRecord | null {
  return allPages().find((page) => page.locale === locale && page.slug === slug) ?? null;
}
