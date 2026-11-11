'use client';

import { GlyphsProvider, Nav } from '@tounsoo/todae';
import { usePathname } from 'next/navigation';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES, localizedGroups } from '../lib/i18n/dictionaries';
import { ChevronIcon } from './icons';
import { renderSiteLink } from './SiteLink';

const GLYPHS = { chevron: <ChevronIcon /> };

/**
 * The sidebar, built from Nav. A link with child pages stays a link; a branch after it shows the child pages,
 * open on a page in the group and opened when navigation moves into it; a branch closed inside the group stays closed.
 */
export function SiteNav({ locale }: { locale: Locale }) {
  const path = usePathname();
  const dict = DICTIONARIES[locale];
  return (
    <GlyphsProvider glyphs={GLYPHS}>
      <Nav.Root className="site-nav" aria-label={dict.siteNav}>
        {localizedGroups(locale).map((group) => (
          <Nav.Group key={group.id} label={group.label}>
            {group.links.map(([href, label, children]) => (
              <Nav.Item key={href}>
                <Nav.Link href={href} render={renderSiteLink} aria-current={path === href ? 'page' : undefined}>
                  {label}
                </Nav.Link>
                {children.length > 0 ? (
                  <Nav.Branch
                    label={dict.subpages.replace('{name}', () => label)}
                    open={path === href || children.some(([child]) => child === path)}
                  >
                    {children.map(([childHref, childLabel]) => (
                      <Nav.Item key={childHref}>
                        <Nav.Link
                          href={childHref}
                          render={renderSiteLink}
                          aria-current={path === childHref ? 'page' : undefined}
                        >
                          {childLabel}
                        </Nav.Link>
                      </Nav.Item>
                    ))}
                  </Nav.Branch>
                ) : null}
              </Nav.Item>
            ))}
          </Nav.Group>
        ))}
      </Nav.Root>
    </GlyphsProvider>
  );
}
