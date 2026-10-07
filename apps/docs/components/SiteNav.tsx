'use client';

import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES, localizedGroups } from '../lib/i18n/dictionaries';

export function SiteNav({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label={DICTIONARIES[locale].siteNav}>
      {localizedGroups(locale).map((group) => (
        <div key={group.id} className="site-nav-group">
          <span id={`nav-${group.id}`} className="site-nav-label">
            {group.label}
          </span>
          <ul aria-labelledby={`nav-${group.id}`}>
            {group.links.map(([href, label]) => {
              const localized = localizePath(href, locale);
              return (
                <li key={href}>
                  <a href={localized} aria-current={path === localized ? 'page' : undefined}>
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
