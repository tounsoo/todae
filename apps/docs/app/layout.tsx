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
              <a href="/composition">Composition</a>
              <a href="/button">Button</a>
              <a href="/chip">Chip</a>
              <a href="/field">Field</a>
              <a href="/label">Label</a>
              <a href="/description">Description</a>
              <a href="/errormessage">ErrorMessage</a>
              <a href="/checkbox">Checkbox</a>
              <a href="/radio">Radio</a>
              <a href="/switch">Switch</a>
              <a href="/dialog">Dialog</a>
              <a href="/popover">Popover</a>
              <a href="/tooltip">Tooltip</a>
              <a href="/optionlist">OptionList</a>
              <a href="/combobox">Combobox</a>
              <a href="/bottomsheet">BottomSheet</a>
              <a href="/stack">Stack</a>
              <a href="/text">Text</a>
              <span>
                Recipes: <a href="/recipes/chip-list">Chip list with overflow</a>
              </span>
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
