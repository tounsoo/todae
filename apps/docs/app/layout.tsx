import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import { Providers } from '../components/Providers';
import { SiteNav } from '../components/SiteNav';
import './globals.css';

export const metadata = {
  title: 'Todae',
  description: 'Todae component docs',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="site-header">
            <a href="/">Todae</a>
            <SiteNav />
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
