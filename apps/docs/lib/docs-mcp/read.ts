import { readFileSync } from 'node:fs';
import { withExampleCode } from '../exampleCode';
import { absolutize, EN_WHEN, pageFor, parseWhen } from './mdx';
import { resolveName } from './meta';
import { allPages, koreanSectionAnchors, type ExampleFile, type PageRecord, type SectionRecord } from './catalog';
import { envelope, LARGE_PAGE_TOKENS, MAX_RESPONSE_CHARS, withFallback, type NextCall } from './budget';
import { searchDocs, type SearchHit } from './search';
import { closeNames, normalizeSlug, SOURCE, tokensOf } from './units';

export type ReadOptions = {
  section?: string;
  /** Inline example source. The response budget still applies. */
  includeCode?: boolean;
  /** Continuation offset into a section or an inlined page, in characters. */
  offset?: number;
  startLine?: number;
  endLine?: number;
};

function decodeAnchor(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Pulls a #anchor out of a slug, path or docs URL. A `ko/` prefix names the English page. */
export function parseTarget(query: string): { slug: string; anchor?: string; fromKorean: boolean } {
  let path = query.trim();
  // A docs URL from any origin, including a preview deploy, names the same page.
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.hash}`;
    } catch {
      // A string that only starts like a URL stays as written.
    }
  }
  path = path.replace(/^[\\/]+/, '');
  const hash = path.indexOf('#');
  const anchor = hash >= 0 ? decodeAnchor(path.slice(hash + 1).split('?')[0] ?? '') : undefined;
  path = (hash >= 0 ? path.slice(0, hash) : path).split('?')[0] ?? '';
  path = path.replace(/\/+$/, '');
  const fromKorean = path === 'ko' || path.startsWith('ko/');
  if (fromKorean) path = path.startsWith('ko/') ? path.slice(3) : '';
  return { slug: path, fromKorean, ...(anchor ? { anchor } : {}) };
}

function matchSlug(slug: string): PageRecord | null {
  const norm = normalizeSlug(slug);
  if (!norm) return null;
  const pages = allPages();
  const exact = pages.find((page) => normalizeSlug(page.slug) === norm);
  if (exact) return exact;
  const suffix = pages.filter((page) => normalizeSlug(page.slug).endsWith(`/${norm}`));
  return suffix.length === 1 ? suffix[0]! : null;
}

function slugForName(name: string): string | null {
  try {
    const resolved = resolveName(name);
    const canonical = resolved.kind === 'namespace' ? resolved.name : resolved.component.name;
    return pageFor(canonical)?.slug ?? null;
  } catch {
    return null;
  }
}

function matchSection(page: PageRecord, query: string): SectionRecord | null {
  const folded = query.trim().toLowerCase();
  const norm = normalizeSlug(query);
  return (
    page.sections.find(
      (section) =>
        section.anchor === query ||
        section.anchor === folded ||
        section.anchor === norm ||
        section.heading.toLowerCase() === folded ||
        normalizeSlug(section.heading) === norm,
    ) ?? null
  );
}

function noHangul(text: string): string {
  return text.replace(/\p{Script=Hangul}/gu, '');
}

function pageMiss(query: string): Error {
  const pages = allPages();
  const near = closeNames(query, pages.map((page) => page.slug));
  const hits = searchDocs(query, { limit: 5 });
  const lines = [
    ...near.map((slug) => `- ${slug}`),
    ...hits
      .filter((hit) => !near.includes(hit.ref.split('#')[0] ?? hit.ref))
      .slice(0, 5)
      .map((hit) => `- ${hit.ref} (${hit.kind}, ${hit.locale}, ${hit.tokens} tokens): ${hit.title}`),
  ];
  const hint = lines.length > 0 ? `Did you mean:\n${lines.join('\n')}\nCall search_docs.` : 'Call search_docs.';
  return new Error(noHangul(`No docs page for "${query}". ${hint}`));
}

function sectionMiss(page: PageRecord, section: string): Error {
  const lines = page.sections.slice(0, 8).map((item) => `- ${page.slug}#${item.anchor} (${item.tokens} tokens): ${item.heading}`);
  return new Error(noHangul(`No section "${section}" on ${page.locale}/${page.slug}. Did you mean:\n${lines.join('\n')}\nPass section as that anchor or heading.`));
}

/** A Korean anchor names the English section in the same position. */
function sectionFor(page: PageRecord, asked: string, fromKorean: boolean): SectionRecord | undefined {
  const direct = matchSection(page, asked);
  if (direct) return direct;
  if (!fromKorean) return undefined;
  const korean = koreanSectionAnchors(page.slug);
  if (!korean) return undefined;
  const folded = asked.trim().toLowerCase();
  const index = korean.findIndex((anchor) => anchor === asked || anchor === folded);
  if (index < 0 || index >= page.sections.length) return undefined;
  return page.sections[index];
}

export function resolvePage(query: string, options?: Pick<ReadOptions, 'section'>): { page: PageRecord; section?: SectionRecord } {
  const target = parseTarget(query);
  const asked = options?.section?.trim() || target.anchor;
  const page = matchSlug(target.slug) ?? matchSlug(normalizeSlug(query)) ?? (() => {
    const slug = slugForName(target.slug) ?? slugForName(query);
    return slug ? (allPages().find((item) => item.slug === slug) ?? null) : null;
  })();
  if (!page) throw pageMiss(query);
  if (!asked) return { page };
  const section = sectionFor(page, asked, target.fromKorean);
  if (section) return { page, section };
  if (target.fromKorean) return { page };
  throw sectionMiss(page, asked);
}

function callsFor(page: PageRecord, section?: SectionRecord): NextCall[] {
  const next: NextCall[] = [];
  const examples = section?.examples ?? page.examples;
  const seen = new Set<string>();
  for (const file of examples) {
    if (seen.has(file.file)) continue;
    seen.add(file.file);
    next.push({
      tool: 'get_example',
      arguments: { page: page.slug, file: file.file },
      why: `${file.file} demonstrates ${file.demonstrates} (${file.lines} lines, ${file.tokens} tokens).`,
    });
  }
  for (const name of page.props.slice(0, 3)) {
    next.push({ tool: 'get_component', arguments: { name }, why: `Props for ${name} are a small read.` });
  }
  if (!section) {
    for (const item of page.sections.filter((item) => item.depth === 2).slice(0, 4)) {
      next.push({
        tool: 'get_docs_page',
        arguments: { name: `${page.slug}#${item.anchor}` },
        why: `Section "${item.heading}" is about ${item.tokens} tokens.`,
      });
    }
  } else {
    const siblings = page.sections.filter((item) => item.depth === section.depth);
    const index = siblings.findIndex((item) => item.anchor === section.anchor);
    for (const item of [siblings[index - 1], siblings[index + 1]].filter((item): item is SectionRecord => item != null)) {
      next.push({
        tool: 'get_docs_page',
        arguments: { name: `${page.slug}#${item.anchor}` },
        why: `Neighboring section "${item.heading}".`,
      });
    }
  }
  return next.slice(0, 8);
}

function windowText(markdown: string, offset: number): { markdown: string; offset: number; cursor: { offset: number } | null } {
  const rest = markdown.slice(offset);
  if (rest.length <= MAX_RESPONSE_CHARS - 2_000) return { markdown: rest, offset, cursor: null };
  const slice = rest.slice(0, MAX_RESPONSE_CHARS - 4_000);
  const newline = slice.lastIndexOf('\n');
  const kept = newline > 0 ? slice.slice(0, newline) : slice;
  const next = offset + kept.length;
  return { markdown: kept, offset, cursor: { offset: next } };
}

function outlineOf(page: PageRecord, note: string) {
  return envelope(
    {
      kind: 'outline' as const,
      locale: page.locale,
      slug: page.slug,
      title: page.title,
      docsUrl: page.docsUrl,
      source: SOURCE,
      note,
      intro: page.intro,
      sections: page.sections.map((section) => ({
        heading: section.heading,
        anchor: section.anchor,
        depth: section.depth,
        tokens: section.tokens,
        ref: `${page.slug}#${section.anchor}`,
      })),
      examples: stubs(page.examples),
      propsTables: page.props,
    },
    'outline',
    callsFor(page),
    { locale: page.locale, slug: page.slug },
  );
}

function stubs(files: ExampleFile[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.file)) return false;
    seen.add(file.file);
    return true;
  }).map((file) => ({
    file: file.file,
    path: file.path,
    demonstrates: file.demonstrates,
    anchor: file.anchor,
    lines: file.lines,
    tokens: file.tokens,
  }));
}

function pageBody(page: PageRecord, markdown: string, note?: string, offset = 0) {
  const windowed = windowText(markdown, offset);
  return envelope(
    {
      kind: 'page' as const,
      locale: page.locale,
      slug: page.slug,
      title: page.title,
      docsUrl: page.docsUrl,
      source: SOURCE,
      ...(note ? { note } : {}),
      ...(windowed.cursor ? { cursor: windowed.cursor, note: note ?? `The page continues at offset ${windowed.cursor.offset}.` } : {}),
      markdown: windowed.markdown,
      examples: stubs(page.examples),
      propsTables: page.props,
    },
    'page',
    callsFor(page),
    { locale: page.locale, slug: page.slug },
  );
}

function sectionBody(page: PageRecord, section: SectionRecord, offset = 0) {
  const windowed = windowText(section.markdown, offset);
  return envelope(
    {
      kind: 'section' as const,
      locale: page.locale,
      slug: page.slug,
      title: page.title,
      section: section.heading,
      anchor: section.anchor,
      docsUrl: `${page.docsUrl}#${section.anchor}`,
      source: SOURCE,
      ...(windowed.cursor ? { cursor: windowed.cursor, note: `The section continues at offset ${windowed.cursor.offset}.` } : {}),
      markdown: windowed.markdown,
      examples: stubs(section.examples),
      propsTables: page.props,
    },
    'section',
    callsFor(page, section),
    { locale: page.locale, slug: page.slug, section: section.anchor },
  );
}

/** A page, one section, or an outline when the stubbed page is over LARGE_PAGE_TOKENS. */
export function readPage(query: string, options: ReadOptions = {}) {
  const { page, section } = resolvePage(query, options);
  if (section) return sectionBody(page, section, options.offset ?? 0);
  if (options.includeCode) {
    const inlined = absolutize(withExampleCode(page.file, readFileSync(page.file, 'utf8')));
    const full = pageBody(
      page,
      inlined,
      'Example source is inlined. A result over the response budget comes back as the outline instead.',
      options.offset ?? 0,
    );
    return withFallback(full, outlineOf(page, 'The page with example code inline does not fit in the response budget, so this is the outline. Fetch a file with get_example.'));
  }
  const stubbed = pageBody(page, page.markdown, undefined, options.offset ?? 0);
  if (stubbed.nav.tokens > LARGE_PAGE_TOKENS && !options.offset) {
    return outlineOf(
      page,
      `This page is over ${LARGE_PAGE_TOKENS} tokens, so this is the outline and the intro. Read a section by its anchor, or pass includeCode when you need the example source inline.`,
    );
  }
  return stubbed;
}

function numberLines(text: string, start: number): string {
  const lines = text.split('\n');
  const width = String(start + lines.length - 1).length;
  return lines.map((line, index) => `${String(start + index).padStart(width)} | ${line}`).join('\n');
}

function findExample(page: PageRecord, file: string): ExampleFile | null {
  const folded = file.trim().toLowerCase();
  return (
    page.examples.find((item) => item.file.toLowerCase() === folded || item.path.toLowerCase() === folded || item.path.toLowerCase().endsWith(`/${folded}`)) ??
    null
  );
}

/** Numbered source for one example file. A long file returns a window and a cursor. */
export function readExample(pageQuery: string, file: string, options: Pick<ReadOptions, 'startLine' | 'endLine'> = {}) {
  const { page } = resolvePage(pageQuery);
  const example = findExample(page, file);
  if (!example) {
    const names = [...new Set(page.examples.map((item) => item.file))];
    throw new Error(`No example "${file}" on ${page.locale}/${page.slug}. Did you mean:\n${names.map((name) => `- ${name}`).join('\n') || '- (this page has no examples)'}\nCall get_example with one of those file names.`);
  }
  const lines = example.text.split('\n');
  const start = Math.max(1, options.startLine ?? 1);
  const end = Math.min(lines.length, options.endLine ?? lines.length);
  if (start > lines.length) throw new Error(`startLine ${start} is past the end of ${example.file} (${lines.length} lines).`);
  let last = Math.max(start, end);
  const slice = (to: number) => numberLines(lines.slice(start - 1, to).join('\n'), start);
  let code = slice(last);
  // Keep the numbered window under the response budget. The cursor names the next line.
  while (last > start && tokensOf(code.length) > 8_000) {
    last = Math.max(start, last - Math.ceil((last - start) / 2));
    code = slice(last);
  }
  const cursor = last < lines.length ? { startLine: last + 1 } : null;
  return envelope(
    {
      kind: 'example' as const,
      locale: page.locale,
      slug: page.slug,
      file: example.file,
      path: example.path,
      demonstrates: example.demonstrates,
      anchor: example.anchor,
      startLine: start,
      endLine: last,
      totalLines: lines.length,
      ...(cursor ? { cursor, note: `Call get_example again with startLine ${cursor.startLine} for the rest.` } : {}),
      code,
      source: SOURCE,
    },
    'example',
    [
      ...(cursor
        ? [{
            tool: 'get_example',
            arguments: { page: page.slug, file: example.file, startLine: cursor.startLine },
            why: 'The next lines of this file.',
          }]
        : []),
      {
        tool: 'get_docs_page',
        arguments: { name: example.anchor ? `${page.slug}#${example.anchor}` : page.slug },
        why: 'The section that shows this example.',
      },
    ],
    { locale: page.locale, slug: page.slug, ...(example.anchor ? { section: example.anchor } : {}) },
  );
}

export function suggest(query: string): SearchHit[] {
  return searchDocs(query, { limit: 5 });
}

export { EN_WHEN, parseWhen, SOURCE };
