'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { LOCALE_NAMES, LOCALES, localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

// usePathname has no query or hash. Read them so every way of following the link keeps the reader's place.
const getSuffix = () => window.location.search + window.location.hash;
const getServerSuffix = () => '';

/** Links to the current page in each language, or to each home page with `toHome`. Each name is written in its own language. */
export function LanguageSwitcher({ locale, toHome = false }: { locale: Locale; toHome?: boolean }) {
  const path = usePathname();
  const suffix = useSyncExternalStore(subscribe, getSuffix, getServerSuffix);
  return (
    <nav className="language-switcher" aria-label={DICTIONARIES[locale].languageNav}>
      <ul>
        {LOCALES.map((target) => (
          <li key={target}>
            <a
              href={localizePath(toHome ? '/' : path + suffix, target)}
              hrefLang={target}
              lang={target}
              aria-current={target === locale ? 'true' : undefined}
            >
              {LOCALE_NAMES[target]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
