'use client';

import { Button, Drawer } from '@omsoo.design/todae';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { MenuIcon } from './icons';
import { SiteNav } from './SiteNav';
import { ThemeSwitcher } from './ThemeSwitcher';

/** The sidebar in a drawer, for screens too narrow to show it. */
export function MobileNav({ locale }: { locale: Locale }) {
  const dict = DICTIONARIES[locale];
  const [open, setOpen] = useState(false);
  // A client-side navigation keeps the drawer mounted, so it closes when the path changes, such as on Back.
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  const [openPath, setOpenPath] = useState(path);
  if (path !== openPath) {
    setOpenPath(path);
    setOpen(false);
  }
  return (
    <div className="mobile-nav">
      <Button.Root
        className="mobile-nav-trigger"
        variant="ghost"
        aria-label={dict.openMenu}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Button.Icon>
          <MenuIcon />
        </Button.Icon>
      </Button.Root>
      <Drawer.Root open={open} onOpenChange={setOpen} side="start" className="mobile-nav-drawer">
        <Drawer.Header>
          <Drawer.Title>Todae</Drawer.Title>
          <Drawer.Close>{dict.closeMenu}</Drawer.Close>
        </Drawer.Header>
        {/* Following one of its links closes it too, even a link to this page, which leaves the path as it is. */}
        <Drawer.Body
          onClick={(event) => {
            // A modified click opens the link elsewhere and leaves this page, and the drawer, as they are.
            const elsewhere = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
            if (!elsewhere && (event.target as Element).closest('a[href]')) setOpen(false);
          }}
        >
          <SiteNav locale={locale} />
        </Drawer.Body>
        {/* The top bar hides its theme switch on the narrowest screens; the drawer keeps one. */}
        <Drawer.Footer>
          <ThemeSwitcher locale={locale} />
        </Drawer.Footer>
      </Drawer.Root>
    </div>
  );
}
