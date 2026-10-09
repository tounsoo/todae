import { join } from 'node:path';
import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { describe, expect, it } from 'vitest';
import { loadPages } from './docs-mcp/mdx';
import { DOCS_ORIGIN } from './origin';
import { LOCALES } from './i18n/config';
import { DICTIONARIES } from './i18n/dictionaries';
import { ENGLISH_PAGES } from './i18n/englishPages';
import { localeMetadata, ogImagePath, pageMetadata } from './i18n/metadata';
import { isTranslated } from './i18n/pages';
import { coreColor, oklchToHex } from './og/colors';
import { displayUrl } from './og/OgCard';
import { ogPages } from './og/pages';
import remarkPageMetadata, { DESCRIPTION_LIMIT, pageOf, pageSummary, summarize } from './remarkPageMetadata.mjs';

const APP = join(process.cwd(), 'app');
const LOCALE_DIRS = { en: '(en)', ko: 'ko' } as const;

function parse(mdx: string): Root {
  return fromMarkdown(mdx, { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] });
}

/** The fields the plugin passes to `pageMetadata`, read back from the node it adds. */
function injected(tree: Root): Record<string, string> | null {
  const node = tree.children.at(-1) as { type: string; data?: { estree?: any } };
  if (node.type !== 'mdxjsEsm') return null;
  const call = node.data!.estree.body[1].declaration.declarations[0].init;
  return Object.fromEntries(call.arguments[0].properties.map((prop: any) => [prop.key.name, prop.value.value]));
}

function run(path: string, mdx: string): Root {
  const tree = parse(mdx);
  remarkPageMetadata()(tree, { path });
  return tree;
}

describe('page metadata', () => {
  it('knows a page file by its locale folder and slug', () => {
    expect(pageOf(join(APP, '(en)', 'utilities', 'use-modal-layer', 'page.mdx'), APP)).toEqual({ locale: 'en', slug: 'utilities/use-modal-layer' });
    expect(pageOf(join(APP, 'ko', 'button', 'page.mdx'), APP)).toEqual({ locale: 'ko', slug: 'button' });
    expect(pageOf(join(APP, '(en)', 'button', 'Demo.mdx'), APP)).toBeNull();
    expect(pageOf(join(APP, '..', 'components', 'page.mdx'), APP)).toBeNull();
  });

  it('cuts a long paragraph at a sentence, or at a word with an ellipsis', () => {
    expect(summarize('Short.  Two\nlines.')).toBe('Short. Two lines.');
    const sentences = `${'A'.repeat(120)}. ${'B'.repeat(120)}.`;
    expect(summarize(sentences)).toBe(`${'A'.repeat(120)}.`);
    const words = Array.from({ length: 60 }, () => 'word').join(' ');
    const cut = summarize(words);
    expect(cut.endsWith('word…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT + 1);
  });

  it('reads code as text and drops link targets and JSX', () => {
    const tree = parse('# `useThing`\n\n`useThing()` reads [the tokens](/tokens) with <b>care</b>.\n');
    expect(pageSummary(tree)).toEqual({ title: 'useThing', description: 'useThing() reads the tokens with care.' });
  });

  it.each(LOCALES)('gives every %s page a title and description from its own text', (locale) => {
    const dir = join(APP, LOCALE_DIRS[locale]);
    const pages = loadPages(dir);
    expect(pages.length).toBeGreaterThan(50);
    for (const page of pages) {
      const fields = injected(run(join(dir, page.slug, 'page.mdx'), page.markdown));
      // The social image draws the same title the metadata names.
      expect(fields, page.slug).toMatchObject({ locale, slug: page.slug, title: page.title });
      const description = fields?.description ?? '';
      expect(description.length, page.slug).toBeGreaterThan(20);
      expect(description.length, page.slug).toBeLessThanOrEqual(DESCRIPTION_LIMIT + 1);
    }
  });

  it("keeps a page's own metadata export", () => {
    const mdx = "export const metadata = { title: 'Own' };\n\n# Page\n\nText.\n";
    const tree = run(join(APP, '(en)', 'page-x', 'page.mdx'), mdx);
    expect(tree.children.filter((node) => node.type === 'mdxjsEsm')).toHaveLength(1);
  });

  it('refuses a page with no title', () => {
    expect(() => run(join(APP, '(en)', 'page-x', 'page.mdx'), 'Text only.\n')).toThrow(/no # title/);
  });

  it('points a Korean page at its own URL, language and image', () => {
    const metadata = pageMetadata({ locale: 'ko', slug: 'utilities/use-modal-layer', title: 'useModalLayer', description: '설명' });
    expect(metadata).toMatchObject({
      title: { absolute: 'useModalLayer · Todae' },
      description: '설명',
      alternates: { canonical: '/ko/utilities/use-modal-layer' },
      openGraph: {
        url: '/ko/utilities/use-modal-layer',
        locale: 'ko_KR',
        siteName: 'Todae',
        images: [{ url: '/og/ko/utilities/use-modal-layer', width: 1200, height: 630 }],
      },
      twitter: { card: 'summary_large_image', images: [{ url: '/og/ko/utilities/use-modal-layer' }] },
    });
    expect(pageMetadata({ locale: 'en', slug: '', title: 'Todae', description: 'x' })).toMatchObject({
      title: { absolute: 'Todae' },
      alternates: { canonical: '/' },
      openGraph: { url: '/', images: [{ url: '/og/en' }] },
    });
  });

  it('gives the shared fallback no URL of its own, since the 404 page uses it', () => {
    const metadata = localeMetadata('ko');
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty('url');
    expect(metadata.description).toBe(DICTIONARIES.ko.hero.lead);
    expect(metadata.metadataBase?.href).toBe(`${DOCS_ORIGIN}/`);
  });
});

describe('social images', () => {
  const pages = ogPages(APP);
  const keys = pages.map((page) => ogImagePath(page.locale, page.slug));

  it('draws one image for every page in every language that has it', () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of LOCALES) {
      expect(keys).toContain(ogImagePath(locale, ''));
      for (const slug of Object.keys(ENGLISH_PAGES)) {
        // A Korean URL that shows the English page uses the English image.
        if (locale === 'en' || isTranslated(locale, slug, APP)) expect(keys, `${locale} ${slug}`).toContain(ogImagePath(locale, slug));
      }
    }
  });

  it('labels every page but the home page with its sidebar section, in its language', () => {
    for (const page of pages) expect(page.eyebrow, `${page.locale} ${page.slug}`).not.toBe('');
    expect(pages.find((page) => page.locale === 'ko' && page.slug === 'utilities/use-modal-layer')?.eyebrow).toBe('유틸리티');
  });

  it('shows the address a reader would type', () => {
    const host = new URL(DOCS_ORIGIN).host;
    expect(displayUrl({ locale: 'en', slug: '' })).toBe(host);
    expect(displayUrl({ locale: 'ko', slug: 'button' })).toBe(`${host}/ko/button`);
  });

  it("converts Todae's OKLCH tokens to the hex the renderer reads", () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
    expect(oklchToHex('oklch(62.8% 0.2577 29.23)')).toBe('#ff0000');
    // The ramp runs light to dark.
    const steps = ['50', '100', '300', '600', '900', '950'].map((step) => parseInt(coreColor(`gray.${step}`).slice(1, 3), 16));
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
    expect(() => oklchToHex('#fff')).toThrow();
  });
});
