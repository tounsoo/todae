'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOCALE_NAMES, LOCALES, localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { SiteLink } from './SiteLink';

/** Links to the current page in each language, or to each home page with `toHome`. Each name is written in its own language. */
export function LanguageSwitcher({ locale, toHome = false }: { locale: Locale; toHome?: boolean }) {
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  // usePathname has no query or hash. Read them so every way of following the link keeps the reader's place.
  // A client-side navigation fires no event, and Next updates the URL as it commits the new path, so they are
  // read again in an effect, which runs after that, whenever the path changes.
  const [suffix, setSuffix] = useState('');
  useEffect(() => {
    const read = () => setSuffix(window.location.search + window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener('popstate', read);
    return () => {
      window.removeEventListener('hashchange', read);
      window.removeEventListener('popstate', read);
    };
  }, [path]);
  return (
    <nav className="language-switcher" aria-label={DICTIONARIES[locale].languageNav}>
      <ul>
        {LOCALES.map((target) => (
          <li key={target}>
            <SiteLink
              href={localizePath(toHome ? '/' : path + suffix, target)}
              hrefLang={target}
              lang={target}
              aria-current={target === locale ? 'true' : undefined}
            >
              {LOCALE_NAMES[target]}
            </SiteLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
