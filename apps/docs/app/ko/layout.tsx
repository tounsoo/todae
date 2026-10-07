import type { ReactNode } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { DICTIONARIES } from '../../lib/i18n/dictionaries';

export const metadata = {
  title: 'Todae',
  description: DICTIONARIES.ko.siteDescription,
};

export default function KoreanLayout({ children }: { children: ReactNode }) {
  return <SiteShell locale="ko">{children}</SiteShell>;
}
