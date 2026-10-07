'use client';

import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALES, localizePath } from '../lib/i18n/config';
import { DOCS_ORIGIN } from '../lib/origin';

/**
 * hreflang links pairing this page with its other languages, so search engines
 * serve the reader's own. React hoists these into `<head>`. A layout cannot do
 * this through `metadata`, which never sees the path.
 */
export function LanguageAlternates() {
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  return (
    <>
      {LOCALES.map((locale) => (
        <link key={locale} rel="alternate" hrefLang={locale} href={DOCS_ORIGIN + localizePath(path, locale)} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={DOCS_ORIGIN + localizePath(path, DEFAULT_LOCALE)} />
    </>
  );
}
