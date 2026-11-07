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
import { estimateEms, TEXT_WIDTH, TITLE_HEIGHT, titleSize } from './og/OgCard';
import { ogPages } from './og/pages';
import { DESCRIPTION_LIMIT, DESCRIPTION_MIN, descriptionWidth, pageSummary, summarize } from './pageSummary.mjs';
import remarkPageMetadata, { ownDescription, pageOf } from './remarkPageMetadata.mjs';

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

  it('keeps the whole sentences that fit, and never cuts one', () => {
    expect(summarize('Short.  Two\nlines.')).toBe('Short. Two lines.');
    const sentence = `${'A'.repeat(70)}.`;
    expect(summarize(`${sentence} ${sentence} ${sentence}`)).toBe(`${sentence} ${sentence}`);
    expect(summarize(`${'word '.repeat(40)}end.`)).toBe('');
    expect(summarize(`${'word '.repeat(40)}end.`, Infinity)).toBe(`${'word '.repeat(40)}end.`);
  });

  it('counts a Hangul character as two Latin letters wide', () => {
    expect(descriptionWidth('Todae')).toBe(5);
    expect(descriptionWidth('토대')).toBe(4);
    expect(summarize(`${'가'.repeat(50)}입니다. ${'나'.repeat(50)}입니다.`)).toBe(`${'가'.repeat(50)}입니다.`);
  });

  it('reads code as text and drops link targets and JSX', () => {
    const tree = parse('# `useThing`\n\n`useThing()` reads [the tokens](/tokens) with <b>care</b>.\n');
    expect(pageSummary(tree)).toEqual({ title: 'useThing', description: 'useThing() reads the tokens with care.' });
  });

  it('takes the description only from before the first section heading', () => {
    expect(pageSummary(parse('# Page\n\n<Demo />\n\n## Usage\n\nSection text.\n'))).toEqual({ title: 'Page', description: '' });
    expect(pageSummary(parse('# Page\n\n<Demo />\n\nIntro.\n\n## Usage\n\nSection text.\n'))).toEqual({ title: 'Page', description: 'Intro.' });
  });

  it.each(LOCALES)('gives every %s page a title and description from its own text', (locale) => {
    const dir = join(APP, LOCALE_DIRS[locale]);
    const pages = loadPages(dir);
    expect(pages.length).toBeGreaterThan(50);
    for (const page of pages) {
      const fields = injected(run(join(dir, page.slug, 'page.mdx'), page.markdown));
      // The social image draws the same title the metadata names.
      expect(fields, page.slug).toMatchObject({ locale, slug: page.slug, title: page.title });
      const width = descriptionWidth(fields?.description ?? '');
      expect(width, page.slug).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(width, page.slug).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
    }
  });

  it('takes a page\'s own description over its intro', () => {
    const mdx = "export const description = 'A description the page wrote for search results and link previews.';\n\n# Page\n\nIntro.\n";
    expect(ownDescription(parse(mdx))).toBe('A description the page wrote for search results and link previews.');
    expect(injected(run(join(APP, '(en)', 'page-x', 'page.mdx'), mdx))?.description).toBe('A description the page wrote for search results and link previews.');
    expect(ownDescription(parse('# Page\n\nIntro.\n'))).toBeNull();
  });

  it('refuses a page whose description is too short or too wide', () => {
    expect(() => run(join(APP, '(en)', 'page-x', 'page.mdx'), '# Page\n\nToo short.\n')).toThrow(/export const description/);
    const long = `export const description = '${'word '.repeat(40)}';\n\n# Page\n\nIntro.\n`;
    expect(() => run(join(APP, '(en)', 'page-x', 'page.mdx'), long)).toThrow(/its own is \d+ wide/);
    expect(() => run(join(APP, '(en)', 'page-x', 'page.mdx'), 'export const description = `x${1}`;\n\n# Page\n\nIntro.\n')).toThrow(/plain string/);
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

  it('sizes every title to fit the text block', () => {
    for (const page of pages) {
      const size = titleSize(page.title);
      const longest = Math.max(...page.title.split(/\s+/).map((word) => estimateEms(word)));
      expect(longest * size, `${page.locale} ${page.slug}`).toBeLessThanOrEqual(TEXT_WIDTH);
      expect(Math.ceil((estimateEms(page.title) * 1.15 * size) / TEXT_WIDTH) * 1.05 * size, `${page.locale} ${page.slug}`).toBeLessThanOrEqual(TITLE_HEIGHT);
      expect(size, `${page.locale} ${page.slug}`).toBeGreaterThanOrEqual(64);
    }
    expect(titleSize('Button')).toBe(200);
    expect(titleSize('useSheetPresentation')).toBeLessThan(titleSize('useModalLayer'));
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
