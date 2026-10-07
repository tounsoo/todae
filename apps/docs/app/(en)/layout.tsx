import type { ReactNode } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { DOCS_ORIGIN } from '../../lib/origin';
import { DICTIONARIES } from '../../lib/i18n/dictionaries';

export const metadata = {
  metadataBase: new URL(DOCS_ORIGIN),
  title: 'Todae',
  description: DICTIONARIES.en.siteDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <SiteShell locale="en">{children}</SiteShell>;
}
