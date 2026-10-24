import { lstatSync, readdirSync, readFileSync, type Dirent } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { parseMdx } from '../mdxAst';
import { DOCS_ORIGIN } from '../origin';
import { listComponentMeta } from './meta';

export type PageDoc = {
  slug: string;
  title: string;
  props: string[];
  markdown: string;
};

export type WhenCopy = {
  whenToUse: string | null;
  whenNotToUse: string | null;
  /** True when the copy is the page section, not a `### Name` subsection. */
  shared: boolean;
};

const WHEN_TO_USE = 'When to use';
const WHEN_NOT_TO_USE = 'When not to use';

/** Names with no props table of their own, whose copy is only a `### Name` block on another page. */
const PART_PAGE: Record<string, string> = {
  ThemeProvider: 'tokens',
  DensityProvider: 'tokens',
  useAppearance: 'tokens',
  useDensity: 'tokens',
  categoryTone: 'tokens',
  useStrings: 'utilities/strings-provider',
  useGlyphs: 'utilities/glyphs-provider',
};

/** Page-level When copy written for these names in addition to `page.title` and its `.Root`. */
const PAGE_OWNERS: Record<string, readonly string[]> = {
  radio: ['RadioGroup', 'RadioGroup.Root', 'RadioGroup.Item'],
};

export function ownsPage(page: PageDoc, name: string): boolean {
  return page.title === name || name === `${page.title}.Root` || PAGE_OWNERS[page.slug]?.includes(name) === true;
}

export function absolutize(markdown: string): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (match, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return match;
    const path = href.startsWith('/') ? href : `/${href.replace(/^\.\//, '')}`;
    return `](${DOCS_ORIGIN}${path})`;
  });
}

type Range = { from: number; to: number };

type Outline = {
  markdown: string;
  /** Top-level headings, with their text as written after the `#`s. */
  headings: (Range & { depth: number; text: string })[];
  /** Top-level paragraphs. */
  paragraphs: Range[];
};

const outlines = new Map<string, Outline>();

/**
 * The page's top-level headings and paragraphs as the MDX compiler parses them, so a `## heading`
 * or `**When:**` line inside a code fence or a JSX element is none. Pages load once, so each is parsed once.
 */
function outline(markdown: string): Outline {
  let found = outlines.get(markdown);
  if (!found) {
    const headings: Outline['headings'] = [];
    const paragraphs: Range[] = [];
    let children: ReturnType<typeof parseMdx>['children'];
    try {
      children = parseMdx(markdown).children;
    } catch (error) {
      // VFileMessage sets `name` to a source position, such as `1:1`.
      if (!(error instanceof Error) || error.constructor.name !== 'VFileMessage') throw error;
      children = [];
    }
    for (const node of children) {
      const range = { from: node.position!.start.offset!, to: node.position!.end.offset! };
      if (node.type === 'heading') {
        headings.push({ ...range, depth: node.depth, text: markdown.slice(range.from, range.to).replace(/^#+[ \t]+/, '').trim() });
      } else if (node.type === 'paragraph') {
        paragraphs.push(range);
      }
    }
    found = { markdown, headings, paragraphs };
    outlines.set(markdown, found);
  }
  return found;
}

function text(page: Outline, range: Range): string {
  return absolutize(page.markdown.slice(range.from, range.to).trim());
}

/** The body of the `## heading` section, up to the next heading of level 1 or 2. */
function section(page: Outline, heading: string): Range | null {
  const index = page.headings.findIndex((item) => item.depth === 2 && item.text === heading);
  if (index < 0) return null;
  const next = page.headings.slice(index + 1).find((item) => item.depth <= 2);
  return { from: page.headings[index]!.to, to: next?.from ?? page.markdown.length };
}

/** The rest of the first paragraph line in `range` that starts with `prefix`. A line, since pages write `**When:**` and `**When not:**` on adjacent lines of one paragraph. */
function marker(page: Outline, range: Range, prefix: string): string | null {
  for (const paragraph of page.paragraphs) {
    if (paragraph.from < range.from || paragraph.to > range.to) continue;
    const line = page.markdown
      .slice(paragraph.from, paragraph.to)
      .split('\n')
      .find((item) => item.trimStart().startsWith(prefix));
    if (line != null) return absolutize(line.trimStart().slice(prefix.length).trim());
  }
  return null;
}

/** `range` split at its `### name` headings: the part before the first one, and each one's body by name. */
function h3Blocks(page: Outline, range: Range): { preamble: Range; blocks: Map<string, Range> } {
  const h3s = page.headings.filter((item) => item.depth === 3 && item.from >= range.from && item.to <= range.to);
  const blocks = new Map<string, Range>();
  h3s.forEach((item, index) => blocks.set(item.text, { from: item.to, to: h3s[index + 1]?.from ?? range.to }));
  return { preamble: { from: range.from, to: h3s[0]?.from ?? range.to }, blocks };
}

function labeled(page: Outline, body: Range, separate: string | null): Pick<WhenCopy, 'whenToUse' | 'whenNotToUse'> {
  const when = marker(page, body, '**When:**');
  const inlineNot = marker(page, body, '**When not:**');
  if (when != null || inlineNot != null) {
    return { whenToUse: when, whenNotToUse: inlineNot ?? (separate || null) };
  }
  return { whenToUse: text(page, body) || null, whenNotToUse: separate || null };
}

/** Page section, or only the `### name` subsection. A dotted name or token provider with no h3 is missing. */
export function parseWhen(markdown: string, name: string): WhenCopy | null {
  const page = outline(markdown);
  const sectionBody = section(page, WHEN_TO_USE);
  const separateRange = section(page, WHEN_NOT_TO_USE);
  if (sectionBody == null && separateRange == null) return null;
  const separate = separateRange ? text(page, separateRange) : null;
  const empty = { from: 0, to: 0 };
  const { preamble, blocks } = h3Blocks(page, sectionBody ?? empty);
  const own = blocks.get(name);
  if (own != null) return { ...labeled(page, own, null), shared: false };
  if (name in PART_PAGE || (blocks.size > 0 && name.includes('.'))) return null;
  const body = blocks.size > 0 ? preamble : (sectionBody ?? empty);
  if (!text(page, body) && !separate) return null;
  return { ...labeled(page, body, separate), shared: true };
}

function staysInside(root: string, full: string): boolean {
  const rel = relative(root, full);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Nested `page.mdx` slugs under `appDir`. Skips symlinks and refuses paths that leave `appDir`. */
function pageSlugs(appDir: string): string[] {
  const slugs: string[] = [];
  const walk = (dir: string) => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (dir !== appDir) return;
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read docs pages: ${detail}`, { cause: error });
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (!staysInside(appDir, full)) continue;
      let stat;
      try {
        stat = lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!stat.isFile() || entry.name !== 'page.mdx') continue;
      const slug = dirname(relative(appDir, full)).split(sep).join('/');
      if (slug !== '.') slugs.push(slug);
    }
  };
  walk(appDir);
  return slugs;
}

export function loadPages(appDir: string): PageDoc[] {
  return pageSlugs(appDir).flatMap((slug) => {
    if (slug.split('/').includes('..') || isAbsolute(slug)) return [];
    const file = join(appDir, slug, 'page.mdx');
    if (!staysInside(appDir, file)) return [];
    let stat;
    try {
      stat = lstatSync(file);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
      if (code === 'ENOENT') return [];
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${slug}/page.mdx: ${detail}`, { cause: error });
    }
    if (stat.isSymbolicLink() || !stat.isFile()) return [];
    let markdown: string;
    try {
      markdown = readFileSync(file, 'utf8');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${slug}/page.mdx: ${detail}`, { cause: error });
    }
    const titleLine = markdown.split('\n').find((line) => line.startsWith('# '));
    if (!titleLine) throw new Error(`Missing title in ${slug}/page.mdx`);
    const props = [...markdown.matchAll(/<PropsTable\s+name="([^"]+)"\s*\/>/g)].map((hit) => hit[1] ?? '');
    return [{ slug, title: titleLine.slice(2), props, markdown }];
  });
}

function readPages(): PageDoc[] {
  // English pages; translations live in app/<locale> and are not read here.
  return loadPages(join(process.cwd(), 'app', '(en)'));
}

const pages = readPages();

export function missingWhenNote(markdown: string, slug: string): string {
  const page = outline(markdown);
  if (section(page, WHEN_TO_USE) != null || section(page, WHEN_NOT_TO_USE) != null) {
    return `'When to use' on /${slug} has no page-level copy; see its parts`;
  }
  return `No 'When to use' section on /${slug}. Not inferred.`;
}

export function listPages(): readonly PageDoc[] {
  return pages;
}

export function pageBySlug(slug: string): PageDoc | null {
  return pages.find((page) => page.slug === slug) ?? null;
}

function findPage(name: string): PageDoc | null {
  const host = PART_PAGE[name];
  if (host) return pages.find((page) => page.slug === host) ?? null;
  return (
    pages.find((page) => page.props.includes(name) || page.title === name) ??
    // A namespace with no page of its own, such as RadioGroup, lives where its parts do.
    (name.includes('.') ? undefined : pages.find((page) => page.props.some((prop) => prop.startsWith(`${name}.`)))) ??
    null
  );
}

export function pageFor(name: string): PageDoc | null {
  const own = findPage(name);
  if (own) return own;
  const dot = name.indexOf('.');
  if (dot <= 0 || !listComponentMeta().some((row) => row.name === name)) return null;
  return findPage(name.slice(0, dot));
}

export function docsUrlFor(name: string): string | null {
  const page = pageFor(name);
  return page ? `${DOCS_ORIGIN}/${page.slug}` : null;
}
