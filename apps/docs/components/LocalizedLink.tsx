'use client';

import type { ComponentProps } from 'react';
import { usePathname } from 'next/navigation';
import { localeOf, localizePath } from '../lib/i18n/config';

/** MDX links. A same-site link stays in the reader's language, so `/tokens` on a Korean page goes to `/ko/tokens`. */
export function LocalizedLink({ href, ...props }: ComponentProps<'a'>) {
  const locale = localeOf(usePathname());
  return <a {...props} href={href === undefined ? undefined : localizePath(href, locale)} />;
}
