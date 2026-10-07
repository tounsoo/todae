'use client';

import { usePathname } from 'next/navigation';
import { LOCALE_NAMES, LOCALES, localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';

/** Links to the current page in each language. Each name is written in its own language. */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const path = usePathname();
  return (
    <nav className="language-switcher" aria-label={DICTIONARIES[locale].languageNav}>
      <ul>
        {LOCALES.map((target) => (
          <li key={target}>
            <a
              href={localizePath(path, target)}
              hrefLang={target}
              lang={target}
              aria-current={target === locale ? 'true' : undefined}
              // usePathname has no query or hash; add them on click so the reader keeps their place.
              onClick={(event) => {
                event.currentTarget.href = localizePath(path + window.location.search + window.location.hash, target);
              }}
            >
              {LOCALE_NAMES[target]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
