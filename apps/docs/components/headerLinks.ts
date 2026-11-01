import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { INDEX_GROUPS } from './siteGroups';

export type HeaderLink = { href: `/${string}`; label: string };

/** The header's links, in order. The same list is inline on a wide screen and in the menu on a narrow one. */
export function headerLinks(locale: Locale): HeaderLink[] {
  const { topLinks } = DICTIONARIES[locale];
  return [
    { href: '/guides/get-started', label: topLinks.start },
    ...INDEX_GROUPS.map((id) => ({ href: `/${id}` as const, label: topLinks[id] })),
    { href: '/playground', label: topLinks.playground },
  ];
}
