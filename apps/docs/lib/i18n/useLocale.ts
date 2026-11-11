'use client';

import { usePathname } from 'next/navigation';
import { localeOf, type Locale } from './config';

/** The locale of the current URL. Null pathnames (outside the app router, such as a demo's own test) are English. */
export function useLocale(): Locale {
  return localeOf(usePathname() ?? '/');
}
