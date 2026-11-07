import { describe, expect, it } from 'vitest';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { DOCS_ORIGIN } from './origin';
import { ENGLISH_PAGES } from './i18n/englishPages';
import { untranslatedSlugs } from './i18n/pages';

describe('robots.txt', () => {
  it('opens every page, keeps crawlers off the MCP endpoint and names the sitemap', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', allow: '/', disallow: '/api/' }, sitemap: `${DOCS_ORIGIN}/sitemap.xml` });
  });
});

describe('sitemap.xml', () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  it('lists every English page and every Korean translation once', () => {
    const fallbacks = untranslatedSlugs('ko');
    const slugs = Object.keys(ENGLISH_PAGES);
    const expected = [
      `${DOCS_ORIGIN}/`,
      `${DOCS_ORIGIN}/ko`,
      ...slugs.map((slug) => `${DOCS_ORIGIN}/${slug}`),
      ...slugs.filter((slug) => !fallbacks.includes(slug)).map((slug) => `${DOCS_ORIGIN}/ko/${slug}`),
    ];
    expect([...urls].sort()).toEqual(expected.sort());
  });

  it('pairs a translated page with its other language, as its hreflang links do', () => {
    const button = entries.find((entry) => entry.url === `${DOCS_ORIGIN}/ko/button`);
    expect(button?.alternates?.languages).toEqual({
      en: `${DOCS_ORIGIN}/button`,
      ko: `${DOCS_ORIGIN}/ko/button`,
      'x-default': `${DOCS_ORIGIN}/button`,
    });
    expect(entries.find((entry) => entry.url === `${DOCS_ORIGIN}/`)?.alternates?.languages?.ko).toBe(`${DOCS_ORIGIN}/ko`);
  });
});
