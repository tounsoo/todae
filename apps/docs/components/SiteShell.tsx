import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';
import { BrandMark } from '../lib/brand';
import { localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
// Reads the file system, so SiteShell renders on the server only.
import { untranslatedByLocale } from '../lib/i18n/pages';
import { GitHubIcon } from './icons';
import { HeaderLinks } from './HeaderLinks';
import { HashHistoryGuard } from './HashHistoryGuard';
import { LanguageAlternates } from './LanguageAlternates';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileNav } from './MobileNav';
import { HTML_APPEARANCE_SCRIPT, SHELL_APPEARANCE_SCRIPT } from './appearanceScript';
import { Providers } from './Providers';
import { Sidebar } from './Sidebar';
import { SiteFooter } from './SiteFooter';
import { SiteLink } from './SiteLink';
import { ThemeSwitcher } from './ThemeSwitcher';
import '../app/globals.css';

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
  return (
    <html lang={locale} data-appearance="system" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HTML_APPEARANCE_SCRIPT }} />
      </head>
      <body>
        {/* A 404 is prerendered once, so its path is Next's internal one: no page to pair. */}
        {!notFound && <LanguageAlternates untranslated={untranslatedByLocale()} />}
        <HashHistoryGuard />
        <Providers>
          <script dangerouslySetInnerHTML={{ __html: SHELL_APPEARANCE_SCRIPT }} />
          <VisuallyHidden.Root focusable>
            <a className="skip-link" href="#content">
              {dict.skipToContent}
            </a>
          </VisuallyHidden.Root>
          <header className="topbar">
            <div className="topbar-inner">
              <MobileNav locale={locale} />
              <SiteLink className="brand" href={localizePath('/', locale)}>
                <BrandMark className="brand-mark" size={22} aria-hidden="true" />
                Todae
              </SiteLink>
              <HeaderLinks locale={locale} />
              <div className="topbar-tools">
                <ThemeSwitcher locale={locale} />
                <LanguageSwitcher locale={locale} toHome={notFound} />
                <SiteLink className="topbar-icon-link" href={REPO} aria-label={dict.github}>
                  <GitHubIcon size={18} />
                </SiteLink>
              </div>
            </div>
          </header>
          <div className="layout">
            <Sidebar locale={locale} />
            <main id="content" tabIndex={-1}>
              {children}
            </main>
          </div>
          <SiteFooter locale={locale} />
        </Providers>
      </body>
    </html>
  );
}
