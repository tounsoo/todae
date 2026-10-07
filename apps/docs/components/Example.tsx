'use client';

import type { ReactNode } from 'react';
import { DEFAULT_LOCALE } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';

export function Example({ children, block }: { children: ReactNode; block?: boolean }) {
  const locale = useLocale();
  return (
    <div className={block ? 'example example-block' : 'example'} role="group" aria-label={DICTIONARIES[locale].example}>
      {locale === DEFAULT_LOCALE ? (
        children
      ) : (
        // Demo copy is written in English; mark it so other locales' pages read it as English.
        <div lang={DEFAULT_LOCALE} style={{ display: 'contents' }}>
          {children}
        </div>
      )}
    </div>
  );
}
