'use client';

import { Button, Dialog, Drawer } from '@omsoo/todae';
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
  // The drawer belongs to the page it opened on, so following one of its links closes it.
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  return (
    <div className="mobile-nav">
      <Button.Root
        className="mobile-nav-trigger"
        variant="ghost"
        aria-label={dict.openMenu}
        aria-haspopup="dialog"
        onClick={() => setOpenOn(path)}
      >
        <Button.Icon>
          <MenuIcon />
        </Button.Icon>
      </Button.Root>
      <Drawer.Root open={open} onOpenChange={(next) => setOpenOn(next ? path : null)} side="start" className="mobile-nav-drawer">
        <Dialog.Header>
          <Dialog.Title>Todae</Dialog.Title>
          <Dialog.Close>{dict.closeMenu}</Dialog.Close>
        </Dialog.Header>
        <Dialog.Body>
          <SiteNav locale={locale} idPrefix="drawer-nav" />
        </Dialog.Body>
        {/* The top bar hides its theme switch on the narrowest screens; the drawer keeps one. */}
        <Dialog.Footer>
          <ThemeSwitcher locale={locale} />
        </Dialog.Footer>
      </Drawer.Root>
    </div>
  );
}
