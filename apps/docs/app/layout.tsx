import type { ReactNode } from 'react';
import '@tounsoo/todae/todae.css';
import './globals.css';

export const metadata = {
  title: 'Todae',
  description: 'Todae component docs',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/">Todae</a>
          <nav className="site-nav" aria-label="Components">
            <a href="/button">Button</a>
            <a href="/stack">Stack</a>
            <a href="/text">Text</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
