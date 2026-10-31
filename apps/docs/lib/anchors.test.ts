import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Node, Root } from 'mdast';
import { describe, expect, it } from 'vitest';
import config from '../next.config.mjs';
import { LOCALES, localizePath, localeOf, stripLocale, type Locale } from './i18n/config';
import { isTranslated } from './i18n/pages';
import { parseMdx } from './mdxAst';
import { pageSections } from './remarkPageContents.mjs';
import { pageOf } from './remarkPageMetadata.mjs';

const APP = join(process.cwd(), 'app');

// Same-site files and routes LocalizedLink does not treat as docs pages.
const NOT_A_PAGE = /\.(css|gif|ico|jpe?g|js|json|pdf|png|svg|txt|webmanifest|webp|woff2?|xml)$/i;
const NON_PAGE_PATH = /^\/(api|_next)(\/|$)/;

type Section = { id: string; children: Section[] };
type Page = { locale: Locale; slug: string; file: string };
type HashLink = { href: string; line: number; dynamic: boolean };

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

function pages(dir: string): Page[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return pages(file);
    const page = entry.name === 'page.mdx' ? pageOf(file, APP) : null;
    return page && isLocale(page.locale) ? [{ locale: page.locale, slug: page.slug, file }] : [];
  });
}

function headingIds(mdx: string): Set<string> {
  const ids = new Set<string>();
  const walk = (sections: Section[]) => {
    for (const section of sections) {
      ids.add(section.id);
      walk(section.children);
    }
  };
  walk(pageSections(parseMdx(mdx)));
  return ids;
}

function pageFile(locale: Locale, slug: string): string {
  return join(APP, locale === 'en' ? '(en)' : locale, slug, 'page.mdx');
}

function expressionText(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('type' in value) || value.type !== 'mdxJsxAttributeValueExpression') return null;
  if (!('value' in value) || typeof value.value !== 'string') return null;
  return value.value;
}

/** A static href, or a dynamic expression the check cannot resolve. */
function hrefOf(value: unknown): { href: string } | { dynamic: string } | null {
  if (typeof value === 'string') return { href: value };
  const raw = expressionText(value);
  if (raw === null) return null;
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return { href: trimmed.slice(1, -1) };
  }
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && !trimmed.includes('${')) return { href: trimmed.slice(1, -1) };
  return { dynamic: trimmed };
}

function walk(node: Node, visit: (node: Node) => void) {
  visit(node);
  if ('children' in node) for (const child of node.children as Node[]) walk(child, visit);
}

function textField(node: object, key: string): string | null {
  const value: unknown = Reflect.get(node, key);
  return typeof value === 'string' ? value : null;
}

function hashLinks(tree: Root): HashLink[] {
  const definitions = new Map<string, string>();
  const links: HashLink[] = [];
  walk(tree, (node) => {
    if (node.type !== 'definition') return;
    const identifier = textField(node, 'identifier');
    const url = textField(node, 'url');
    if (identifier && url) definitions.set(identifier, url);
  });
  walk(tree, (node) => {
    const line = node.position?.start.line ?? 0;
    if (node.type === 'link') {
      const url = textField(node, 'url');
      if (url) links.push({ href: url, line, dynamic: false });
    }
    if (node.type === 'linkReference') {
      const href = definitions.get(textField(node, 'identifier') ?? '');
      if (href) links.push({ href, line, dynamic: false });
    }
    if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return;
    if (!('attributes' in node) || !Array.isArray(node.attributes)) return;
    for (const attribute of node.attributes) {
      if (typeof attribute !== 'object' || attribute === null) continue;
      if (textField(attribute, 'type') !== 'mdxJsxAttribute' || textField(attribute, 'name') !== 'href') continue;
      const href = hrefOf('value' in attribute ? attribute.value : undefined);
      if (!href) continue;
      if ('dynamic' in href) links.push({ href: href.dynamic, line, dynamic: true });
      else links.push({ href: href.href, line, dynamic: false });
    }
  });
  return links;
}

function external(path: string): boolean {
  return path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path);
}

function pathSlug(path: string): string {
  return stripLocale(path).replace(/^\/|\/$/g, '');
}

/** The page a reader of `page` opens for `path` (empty means this page), after one exact redirect. */
function openedPath(path: string, page: Page, redirects: ReadonlyMap<string, string>): string {
  const localized = path === '' ? localizePath(page.slug ? `/${page.slug}` : '/', page.locale) : localizePath(path, page.locale);
  return redirects.get(localized) ?? localized;
}

/**
 * Same-site hashes whose fragment is not a heading id on the page a reader of that
 * locale opens. Link targets stay in the reader's language, as `LocalizedLink` does.
 */
function brokenAnchors(redirects: ReadonlyMap<string, string>): { pages: number; broken: string[] } {
  const listed = pages(APP);
  const ids = new Map<string, Set<string> | null>();
  const idsOf = (locale: Locale, slug: string): Set<string> | null => {
    const key = `${locale}/${slug}`;
    const cached = ids.get(key);
    if (cached !== undefined) return cached;
    const file = pageFile(locale, slug);
    const found = existsSync(file)
      ? headingIds(readFileSync(file, 'utf8'))
      : locale !== 'en' && !isTranslated(locale, slug)
        ? idsOf('en', slug)
        : null;
    ids.set(key, found);
    return found;
  };
  const broken: { page: string; line: number; href: string; detail: string }[] = [];
  for (const page of listed) {
    for (const link of hashLinks(parseMdx(readFileSync(page.file, 'utf8')))) {
      const mark = link.href.indexOf('#');
      if (link.dynamic) {
        if (!link.href.includes('#')) continue;
        if (external(link.href)) continue;
        broken.push({ page: `${page.locale}/${page.slug}`, line: link.line, href: link.href, detail: 'is not a literal href' });
        continue;
      }
      if (mark < 0) continue;
      const fragment = decodeURIComponent(link.href.slice(mark + 1));
      const [path = ''] = link.href.slice(0, mark).split('?');
      if (!fragment || external(path) || NOT_A_PAGE.test(path) || NON_PAGE_PATH.test(path)) continue;
      const where = `${page.locale}/${page.slug}`;
      if (path !== '' && !path.startsWith('/')) {
        broken.push({ page: where, line: link.line, href: link.href, detail: 'is not a same-site path' });
        continue;
      }
      const opened = openedPath(path, page, redirects);
      const target = { locale: localeOf(opened), slug: pathSlug(opened) };
      const headings = idsOf(target.locale, target.slug);
      if (headings?.has(fragment)) continue;
      const detail = headings === null ? `has no page ${target.locale}/${target.slug}` : `is not a heading on ${target.locale}/${target.slug}`;
      broken.push({ page: where, line: link.line, href: link.href, detail });
    }
  }
  broken.sort((a, b) => a.page.localeCompare(b.page) || a.line - b.line || a.href.localeCompare(b.href));
  return { pages: listed.length, broken: broken.map((item) => `${item.page}:${item.line} ${item.href} ${item.detail}`) };
}

describe('docs anchors', () => {
  it('resolves every same-site hash to a heading id on that page in that language', async () => {
    if (!config.redirects) throw new Error('docs redirects are missing');
    const redirects = new Map<string, string>();
    for (const redirect of await config.redirects()) {
      if (typeof redirect.destination === 'string') redirects.set(redirect.source, redirect.destination);
    }
    const { pages: count, broken } = brokenAnchors(redirects);
    expect(count).toBeGreaterThan(40);
    expect(broken).toEqual([]);
  });
});
