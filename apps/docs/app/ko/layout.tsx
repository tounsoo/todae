import type { ReactNode } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { localeMetadata } from '../../lib/i18n/metadata';

export const metadata = localeMetadata('ko');

export default function KoreanLayout({ children }: { children: ReactNode }) {
  return <SiteShell locale="ko">{children}</SiteShell>;
}
