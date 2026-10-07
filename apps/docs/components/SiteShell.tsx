import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import { localizePath, type Locale } from '../lib/i18n/config';
// Reads the file system, so SiteShell renders on the server only.
import { untranslatedByLocale } from '../lib/i18n/pages';
import { LanguageAlternates } from './LanguageAlternates';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Providers } from './Providers';
import { SiteNav } from './SiteNav';
import '../app/globals.css';

/** The document for one locale. Each locale's root layout renders it, so `<html lang>` is right from the server. */
export function SiteShell({
  locale,
  notFound = false,
  children,
}: {
  locale: Locale;
  /** On a 404 the same path is missing in every language, so the switcher goes home instead. */
  notFound?: boolean;
  children: ReactNode;
}) {
  return (
    <html lang={locale}>
      <body>
        {/* A 404 is prerendered once, so its path is Next's internal one: no page to pair. */}
        {!notFound && <LanguageAlternates untranslated={untranslatedByLocale()} />}
        <Providers>
          <header className="site-header">
            <div className="site-header-top">
              <a href={localizePath('/', locale)}>Todae</a>
              <LanguageSwitcher locale={locale} toHome={notFound} />
            </div>
            <SiteNav locale={locale} />
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
