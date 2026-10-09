'use client';

import { Link } from '@tounsoo/todae/link';
import type { ComponentProps } from 'react';
import { localizePath } from '../lib/i18n/config';
import { useLocale } from '../lib/i18n/useLocale';

/** MDX links, as Link.Root. A same-site link stays in the reader's language, so `/tokens` on a Korean page goes to `/ko/tokens`. */
export function LocalizedLink({ href, ...props }: ComponentProps<'a'>) {
  const locale = useLocale();
  return <Link.Root {...props} href={href === undefined ? undefined : localizePath(href, locale)} />;
}
