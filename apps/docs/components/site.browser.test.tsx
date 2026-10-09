import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../app/globals.css';
import { APPEARANCE_KEY, APPEARANCE_SCRIPT } from './appearanceScript';
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

describe('playground stage', () => {
  function renderPlayground() {
    render(
      <Providers>
        <main>
          <Playground locale="en" />
        </main>
      </Providers>,
    );
    return screen.getByRole('region', { name: 'Preview' });
  }

  it('takes a preset typeface on the stage only, and the site keeps its own', async () => {
    const stage = renderPlayground();
    await userEvent.click(screen.getByText('Editorial'));
    await frame();
    expect(getComputedStyle(stage).fontFamily).toContain('Fraunces');
    expect(getComputedStyle(screen.getByRole('button', { name: 'Copy JSON' })).fontFamily).not.toContain('Fraunces');
    expect(getComputedStyle(document.querySelector('.shell') as Element).fontFamily).toContain('Apple SD Gothic Neo');
  });

  it('applies both raw and semantic space edits to density tokens', async () => {
    const stage = renderPlayground();
    const invite = () => getComputedStyle(within(stage).getByRole('button', { name: 'Invite' })).paddingInlineStart;
    await userEvent.click(screen.getByRole('tab', { name: 'raw' }));
    await userEvent.fill(screen.getByLabelText('space.3'), '2rem');
    await frame();
    expect(invite()).toBe('32px');
    await userEvent.click(screen.getByRole('tab', { name: 'semantic' }));
    await userEvent.fill(screen.getByLabelText('space.control.x'), '3rem');
    await frame();
    expect(invite()).toBe('48px');
  });
});

describe('appearance before hydration', () => {
  // What the server sends: the shell with "system", then the inline script.
  function serverShell(): HTMLElement {
    const shell = document.createElement('div');
    shell.setAttribute('data-appearance', 'system');
    // The script sits in the shell's DensityProvider, not directly in the shell.
    const density = document.createElement('div');
    density.setAttribute('data-density', 'comfortable');
    shell.append(density);
    document.body.append(shell);
    const script = document.createElement('script');
    script.textContent = APPEARANCE_SCRIPT;
    density.append(script);
    return shell;
  }

  afterEach(() => {
    window.localStorage.removeItem(APPEARANCE_KEY);
    document.body.replaceChildren();
  });

  it('applies a stored pick before React runs', () => {
    window.localStorage.setItem(APPEARANCE_KEY, 'dark');
    expect(serverShell().getAttribute('data-appearance')).toBe('dark');
  });

  it('leaves "system" for no pick or an unknown one', () => {
    expect(serverShell().getAttribute('data-appearance')).toBe('system');
    window.localStorage.setItem(APPEARANCE_KEY, 'sepia');
    expect(serverShell().getAttribute('data-appearance')).toBe('system');
  });
});
