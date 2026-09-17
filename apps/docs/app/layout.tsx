import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import { Providers } from '../components/Providers';
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
            <nav className="site-nav" aria-label="Site">
              <a href="/button">Button</a>
              <a href="/chip">Chip</a>
              <a href="/textfield">TextField</a>
              <a href="/chipfield">ChipField</a>
              <a href="/stack">Stack</a>
              <a href="/text">Text</a>
              <a href="/tokens">Tokens</a>
              <a href="/playground">Playground</a>
            </nav>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
