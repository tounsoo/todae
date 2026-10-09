import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../app/globals.css';
import { HomeContent } from './HomeContent';
import { MobileNav } from './MobileNav';
import { Playground } from './Playground';
import { Providers } from './Providers';
import { ThemeSwitcher } from './ThemeSwitcher';

afterEach(cleanup);

// axe's color-contrast rule is WCAG 2; Todae checks contrast with APCA, so it is off here.
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
}

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

describe('docs site chrome under axe', () => {
  it('home page', async () => {
    render(
      <Providers>
        <main>
          <HomeContent locale="en" />
        </main>
      </Providers>,
    );
    await frame();
    expect(await violations()).toEqual([]);
  });

  it('top bar tools and the open mobile drawer', async () => {
    render(
      <Providers>
        <header>
          <MobileNav locale="en" />
          <ThemeSwitcher locale="en" />
        </header>
      </Providers>,
    );
    await frame();
    expect(await violations()).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    await frame();
    expect(screen.getByRole('dialog', { name: 'Todae' })).toBeTruthy();
    expect(await violations()).toEqual([]);
  });

  it('playground, with a preset in dark', async () => {
    render(
      <Providers>
        <main>
          <Playground locale="en" />
        </main>
      </Providers>,
    );
    await frame();
    expect(await violations()).toEqual([]);
    await userEvent.click(screen.getByText('Forest'));
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    await frame();
    expect(await violations()).toEqual([]);
  });
});
