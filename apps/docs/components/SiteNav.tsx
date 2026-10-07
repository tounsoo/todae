'use client';

import { usePathname } from 'next/navigation';
import { SITE_GROUPS } from './siteGroups';

export function SiteNav() {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="Site">
      {SITE_GROUPS.map((group) => (
        <div key={group.id} className="site-nav-group">
          <span id={`nav-${group.id}`} className="site-nav-label">
            {group.label}
          </span>
          <ul aria-labelledby={`nav-${group.id}`}>
            {group.links.map(([href, label]) => (
              <li key={href}>
                <a href={href} aria-current={path === href ? 'page' : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
