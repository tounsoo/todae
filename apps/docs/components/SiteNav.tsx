'use client';

import { Disclosure, GlyphsProvider, VisuallyHidden } from '@omsoo/todae';
import { usePathname } from 'next/navigation';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES, localizedGroups } from '../lib/i18n/dictionaries';
import { ChevronIcon } from './icons';
import { SiteLink } from './SiteLink';

const GLYPHS = { chevron: <ChevronIcon /> };

/**
 * The sidebar. `idPrefix` keeps group label ids unique when a second copy renders in the mobile drawer.
 * A link with child pages stays a link; a disclosure after it shows the child pages as a nested list,
 * open on a page in the group and opened when navigation moves into it; a list closed inside the group stays closed.
 */
export function SiteNav({ locale, idPrefix = 'nav' }: { locale: Locale; idPrefix?: string }) {
  const path = usePathname();
  const dict = DICTIONARIES[locale];
  return (
    <nav className="site-nav" aria-label={dict.siteNav}>
      {localizedGroups(locale).map((group) => (
        <div key={group.id} className="site-nav-group">
          <span id={`${idPrefix}-${group.id}`} className="site-nav-label">
            {group.label}
          </span>
          <ul aria-labelledby={`${idPrefix}-${group.id}`}>
            {group.links.map(([href, label, children]) => (
              <li key={href} className={children.length > 0 ? 'site-nav-branch' : undefined}>
                <SiteLink href={href} aria-current={path === href ? 'page' : undefined}>
                  {label}
                </SiteLink>
                {children.length > 0 ? (
                  <GlyphsProvider glyphs={GLYPHS}>
                    <Disclosure.Root open={path === href || children.some(([child]) => child === path)}>
                      <Disclosure.Summary>
                        <VisuallyHidden.Root>{dict.subpages.replace('{name}', () => label)}</VisuallyHidden.Root>
                      </Disclosure.Summary>
                      <ul>
                        {children.map(([childHref, childLabel]) => (
                          <li key={childHref}>
                            <SiteLink href={childHref} aria-current={path === childHref ? 'page' : undefined}>
                              {childLabel}
                            </SiteLink>
                          </li>
                        ))}
                      </ul>
                    </Disclosure.Root>
                  </GlyphsProvider>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
