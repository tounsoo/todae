import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../lib/i18n/config';
import { ENGLISH_PAGES } from '../lib/i18n/englishPages';
import { pagePath } from '../lib/i18n/metadata';
import { isTranslated } from '../lib/i18n/pages';
import { DOCS_ORIGIN } from '../lib/origin';

/** The full URL of a page in `locale`, as its canonical link names it. */
const url = (locale: Locale, slug: string) => DOCS_ORIGIN + pagePath(locale, slug);

/**
 * Every page, once per language that has it, with its other languages as
 * alternates. A locale's URL that only shows the English page canonicalizes to
 * the English one, so it is left out. Build time only: it reads the page files.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', ...Object.keys(ENGLISH_PAGES)].flatMap((slug) => {
    const locales = LOCALES.filter((locale) => locale === DEFAULT_LOCALE || isTranslated(locale, slug));
    const languages = locales.length < 2 ? undefined : { ...Object.fromEntries(locales.map((locale) => [locale, url(locale, slug)])), 'x-default': url(DEFAULT_LOCALE, slug) };
    return locales.map((locale) => ({ url: url(locale, slug), ...(languages && { alternates: { languages } }) }));
  });
}
