import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import { localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
// Reads the file system, so SiteShell renders on the server only.
import { untranslatedByLocale } from '../lib/i18n/pages';
import { GitHubIcon } from './icons';
import { LanguageAlternates } from './LanguageAlternates';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileNav } from './MobileNav';
import { Providers } from './Providers';
import { SiteNav } from './SiteNav';
import { ThemeSwitcher } from './ThemeSwitcher';
import '../app/globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--docs-font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--docs-font-mono' });

const REPO = 'https://github.com/tounsoo/todae';

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
  const dict = DICTIONARIES[locale];
  const top = [
    ['/guides/build-on-todae', dict.topLinks.start],
    ['/button', dict.topLinks.components],
    ['/playground', dict.topLinks.playground],
  ] as const;
  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
      <body>
        {/* A 404 is prerendered once, so its path is Next's internal one: no page to pair. */}
        {!notFound && <LanguageAlternates untranslated={untranslatedByLocale()} />}
        <Providers>
          <a className="skip-link todae-visually-hidden-focusable" href="#content">
            {dict.skipToContent}
          </a>
          <header className="topbar">
            <div className="topbar-inner">
              <MobileNav locale={locale} />
              <a className="brand" href={localizePath('/', locale)}>
                <span className="brand-mark" aria-hidden="true" />
                Todae
              </a>
              <nav className="top-links" aria-label={dict.mainNav}>
                <ul>
                  {top.map(([href, label]) => (
                    <li key={href}>
                      <a href={localizePath(href, locale)}>{label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="topbar-tools">
                <ThemeSwitcher locale={locale} />
                <LanguageSwitcher locale={locale} toHome={notFound} />
                <a className="topbar-icon-link" href={REPO} aria-label={dict.github}>
                  <GitHubIcon size={18} />
                </a>
              </div>
            </div>
          </header>
          <div className="layout">
            <aside className="sidebar">
              <SiteNav locale={locale} />
            </aside>
            <main id="content" tabIndex={-1}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
