import { Link } from '@tounsoo/todae/link';
import type { ReactNode } from 'react';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';

export const TRANSLATING_GUIDE = 'https://github.com/tounsoo/todae/blob/main/apps/docs/TRANSLATING.md';

/** An English page shown in another locale, marked as English so screen readers and search engines read it right. */
export function UntranslatedPage({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = DICTIONARIES[locale];
  return (
    <>
      <p className="untranslated-notice" role="note">
        {dict.untranslated} <Link.Root href={TRANSLATING_GUIDE}>{dict.contribute}</Link.Root>
      </p>
      <div lang="en">{children}</div>
    </>
  );
}
