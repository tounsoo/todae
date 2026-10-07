import type { ReactNode } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { localeMetadata } from '../../lib/i18n/metadata';

export const metadata = localeMetadata('en');

export default function RootLayout({ children }: { children: ReactNode }) {
  return <SiteShell locale="en">{children}</SiteShell>;
}
