'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, localeOf } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';

export function Example({ children, block }: { children: ReactNode; block?: boolean }) {
  // Null outside the app router, such as in a demo's own test.
  const locale = localeOf(usePathname() ?? '/');
  return (
    <div
      className={block ? 'example example-block' : 'example'}
      role="group"
      aria-label={DICTIONARIES[locale].example}
      // Demo copy is written in English; mark it so it is read as English on other locales' pages.
      lang={locale === DEFAULT_LOCALE ? undefined : DEFAULT_LOCALE}
    >
      {children}
    </div>
  );
}
