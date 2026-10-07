'use client';

import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALES, localizePath, stripLocale, type Locale } from '../lib/i18n/config';
import { DOCS_ORIGIN } from '../lib/origin';

/**
 * hreflang links pairing this page with its other languages, so search engines
 * serve the reader's own. React hoists these into `<head>`. A layout cannot do
 * this through `metadata`, which never sees the path.
 *
 * `untranslated` lists, per locale, the slugs that only show the English page.
 * Those canonicalize to English, so they are not a language version of their own.
 */
export function LanguageAlternates({ untranslated = {} }: { untranslated?: Partial<Record<Locale, string[]>> }) {
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  const slug = stripLocale(path).slice(1);
  const locales = LOCALES.filter((locale) => !untranslated[locale]?.includes(slug));
  // Only English: nothing to pair.
  if (locales.length < 2) return null;
  return (
    <>
      {locales.map((locale) => (
        <link key={locale} rel="alternate" hrefLang={locale} href={DOCS_ORIGIN + localizePath(path, locale)} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={DOCS_ORIGIN + localizePath(path, DEFAULT_LOCALE)} />
    </>
  );
}
