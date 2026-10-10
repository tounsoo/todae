'use client';

import { ScrollArea } from '@omsoo/todae';
import type { Locale } from '../lib/i18n/config';
import { SiteNav } from './SiteNav';

/** The wide-screen sidebar. A client module, since ScrollArea comes from the main entry. */
export function Sidebar({ locale }: { locale: Locale }) {
  return (
    <aside className="sidebar">
      <ScrollArea.Root className="sidebar-scroll" focusable={false}>
        <SiteNav locale={locale} />
      </ScrollArea.Root>
    </aside>
  );
}
