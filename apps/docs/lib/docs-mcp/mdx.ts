import { lstatSync, readdirSync, readFileSync, type Dirent } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { listComponentMeta } from './meta';

export const DOCS_ORIGIN = 'https://todae-rho.vercel.app';

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

/** Names whose copy is only a `### Name` block on another page (same as Field parts). */
const PART_PAGE: Record<string, string> = {
  ThemeProvider: 'tokens',
  DensityProvider: 'tokens',
};

/** Page-level When copy written for these names in addition to `page.title` and its `.Root`. */
const PAGE_OWNERS: Record<string, readonly string[]> = {
  'recipes/combobox': ['useCombobox'],
  radio: ['RadioGroup', 'RadioGroup.Root', 'RadioGroup.Item'],
  'recipes/chip-list': ['useChipList'],
};

export function ownsPage(page: PageDoc, name: string): boolean {
  return page.title === name || name === `${page.title}.Root` || PAGE_OWNERS[page.slug]?.includes(name) === true;
}

function absolutize(markdown: string): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (match, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return match;
    const path = href.startsWith('/') ? href : `/${href.replace(/^\.\//, '')}`;
    return `](${DOCS_ORIGIN}${path})`;
  });
}

function section(markdown: string, heading: string): string | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line === `## ${heading}`);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^#{1,2} /.test(line)) {
      end = i;
      break;
    }
  }
  return absolutize(lines.slice(start + 1, end).join('\n').trim());
}

function marker(body: string, prefix: string): string | null {
  const line = body.split('\n').find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : null;
}

function h3Blocks(body: string): { preamble: string; blocks: Map<string, string> } {
  const blocks = new Map<string, string>();
  const preamble: string[] = [];
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (current === null) preamble.push(text);
    else blocks.set(current, text);
    buf = [];
  };
  for (const line of body.split('\n')) {
    const heading = /^### (.+)$/.exec(line);
    if (heading?.[1]) {
      flush();
      current = heading[1];
      continue;
    }
    buf.push(line);
  }
  flush();
  return { preamble: preamble.join('\n').trim(), blocks };
}

function labeled(body: string, separate: string | null): Pick<WhenCopy, 'whenToUse' | 'whenNotToUse'> {
  const when = marker(body, '**When:**');
  const inlineNot = marker(body, '**When not:**');
  if (when != null || inlineNot != null) {
    return { whenToUse: when, whenNotToUse: inlineNot ?? (separate?.trim() || null) };
  }
  return { whenToUse: body.trim() || null, whenNotToUse: separate?.trim() || null };
}

/** Page section, or only the `### name` subsection. A dotted name or token provider with no h3 is missing. */
export function parseWhen(markdown: string, name: string): WhenCopy | null {
  const sectionBody = section(markdown, WHEN_TO_USE);
  const separate = section(markdown, WHEN_NOT_TO_USE);
  if (sectionBody == null && separate == null) return null;
  const { preamble, blocks } = h3Blocks(sectionBody ?? '');
  const own = blocks.get(name);
  if (own != null) return { ...labeled(own, null), shared: false };
  if (name in PART_PAGE || (blocks.size > 0 && name.includes('.'))) return null;
  const body = blocks.size > 0 ? preamble : (sectionBody ?? '');
  if (!body.trim() && !separate?.trim()) return null;
  return { ...labeled(body, separate), shared: true };
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
      throw new Error(`Failed to read docs pages: ${detail}`);
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
      throw new Error(`Failed to read ${slug}/page.mdx: ${detail}`);
    }
    if (stat.isSymbolicLink() || !stat.isFile()) return [];
    let markdown: string;
    try {
      markdown = readFileSync(file, 'utf8');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${slug}/page.mdx: ${detail}`);
    }
    const titleLine = markdown.split('\n').find((line) => line.startsWith('# '));
    if (!titleLine) throw new Error(`Missing title in ${slug}/page.mdx`);
    const props = [...markdown.matchAll(/<PropsTable\s+name="([^"]+)"\s*\/>/g)].map((hit) => hit[1] ?? '');
    return [{ slug, title: titleLine.slice(2), props, markdown }];
  });
}

function readPages(): PageDoc[] {
  return loadPages(join(process.cwd(), 'app'));
}

const pages = readPages();

export function missingWhenNote(markdown: string, slug: string): string {
  if (section(markdown, WHEN_TO_USE) != null || section(markdown, WHEN_NOT_TO_USE) != null) {
    return `'When to use' on /${slug} has no page-level copy; see its parts`;
  }
  return `No 'When to use' section on /${slug}. Not inferred.`;
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
