'use client';

import { Stack } from '@tounsoo/todae/stack';
import { usePathname } from 'next/navigation';
import { localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { headerLinks } from './headerLinks';
import { SiteLink } from './SiteLink';

/** The header's links. `menu` is the copy inside the narrow-screen drawer. */
export function HeaderLinks({ locale, menu = false }: { locale: Locale; menu?: boolean }) {
  const path = usePathname() ?? '/';
  const dict = DICTIONARIES[locale];
  return (
    <nav className={menu ? 'drawer-links' : 'top-links'} aria-label={dict.mainNav}>
      <Stack.Root as="ul" direction={menu ? 'column' : 'row'} gap="condensed">
        {headerLinks(locale).map(({ href, label }) => {
          const to = localizePath(href, locale);
          return (
            <li key={href}>
              <SiteLink href={to} aria-current={path === to ? 'page' : undefined}>
                {label}
              </SiteLink>
            </li>
          );
        })}
      </Stack.Root>
    </nav>
  );
}
