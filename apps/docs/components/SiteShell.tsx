import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import { Stack } from '@tounsoo/todae/stack';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';
import { BrandMark } from '../lib/brand';
import { localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
// Reads the file system, so SiteShell renders on the server only.
import { untranslatedByLocale } from '../lib/i18n/pages';
import { GitHubIcon } from './icons';
import { HashHistoryGuard } from './HashHistoryGuard';
import { LanguageAlternates } from './LanguageAlternates';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileNav } from './MobileNav';
import { APPEARANCE_SCRIPT } from './appearanceScript';
import { Providers } from './Providers';
import { Sidebar } from './Sidebar';
import { SiteFooter } from './SiteFooter';
import { SiteLink } from './SiteLink';
import { SITE_GROUPS } from './siteGroups';
import { ThemeSwitcher } from './ThemeSwitcher';
import '../app/globals.css';

const REPO = 'https://github.com/tounsoo/todae';
// The top bar's Components link opens the first page the sidebar lists under Components.
const FIRST_COMPONENT = SITE_GROUPS.find((group) => group.id === 'components')?.links[0]?.[0] ?? '/';

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
    ['/guides/get-started', dict.topLinks.start],
    [FIRST_COMPONENT, dict.topLinks.components],
    ['/playground', dict.topLinks.playground],
  ] as const;
  return (
    <html lang={locale}>
      <body>
        {/* A 404 is prerendered once, so its path is Next's internal one: no page to pair. */}
        {!notFound && <LanguageAlternates untranslated={untranslatedByLocale()} />}
        <HashHistoryGuard />
        <Providers>
          <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
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
              <nav className="top-links" aria-label={dict.mainNav}>
                <Stack.Root as="ul" direction="row" gap="condensed">
                  {top.map(([href, label]) => (
                    <li key={href}>
                      <SiteLink href={localizePath(href, locale)}>{label}</SiteLink>
                    </li>
                  ))}
                </Stack.Root>
              </nav>
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
