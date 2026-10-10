import { cleanup, render, screen, within } from '@testing-library/react';
import { page, userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@omsoo/todae/todae.css';
import '../app/globals.css';
import { APPEARANCE_KEY, APPEARANCE_SCRIPT } from './appearanceScript';
import { HomeContent } from './HomeContent';
import { MobileNav } from './MobileNav';
import { Playground } from './Playground';
import { Providers } from './Providers';
import { PropsTable } from './PropsTable';
import { PropsTableView, type PropsTableRow } from './PropsTableView';
import schema from '@omsoo/todae/schema/components.json';
import { ThemeSwitcher } from './ThemeSwitcher';

afterEach(cleanup);

const path = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

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

describe('narrow screens', () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it('keeps a theme switch in the drawer when the top bar drops its own', async () => {
    await page.viewport(360, 700);
    render(
      <Providers>
        <header className="topbar">
          <MobileNav locale="en" />
          <div className="topbar-tools">
            <ThemeSwitcher locale="en" />
          </div>
        </header>
      </Providers>,
    );
    await frame();
    expect(document.querySelector('.topbar-tools .theme-switcher')?.checkVisibility()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    await frame();
    const drawer = screen.getByRole('dialog', { name: 'Todae' });
    expect(within(drawer).getByRole('group', { name: 'Theme' }).checkVisibility()).toBe(true);
  });

  it('keeps the home showcase header inside its card on a phone', async () => {
    await page.viewport(320, 700);
    render(
      <Providers>
        <HomeContent locale="en" />
      </Providers>,
    );
    await frame();
    const card = document.querySelector('.showcase-card')!.getBoundingClientRect();
    for (const el of document.querySelectorAll('.showcase-title > *, .showcase-meta > *')) {
      const box = el.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(card.left);
      expect(box.right).toBeLessThanOrEqual(card.right);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});

describe('mobile drawer', () => {
  afterEach(async () => {
    path.current = '/';
    await page.viewport(1280, 800);
  });

  const shell = () => (
    <Providers>
      <MobileNav locale="en" />
    </Providers>
  );
  const drawer = () => screen.queryByRole('dialog', { name: 'Todae' });
  async function openDrawer() {
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    await frame();
    expect(drawer()).toBeTruthy();
  }

  it('closes when the page changes, and stays closed on the way back', async () => {
    await page.viewport(360, 700);
    path.current = '/tokens';
    const { rerender } = render(shell());
    await openDrawer();
    // A client-side navigation keeps the drawer mounted and changes only the path.
    path.current = '/link';
    rerender(shell());
    // It slides out before the dialog closes.
    await expect.poll(drawer).toBeNull();
    path.current = '/tokens';
    rerender(shell());
    await frame();
    expect(drawer()).toBeNull();
  });

  it('closes on a link to the page already shown', async () => {
    await page.viewport(360, 700);
    path.current = '/tokens';
    render(shell());
    await openDrawer();
    const link = within(drawer()!).getByRole('link', { name: 'Tokens' });
    // Keep the test page in place; the drawer only needs the click.
    link.addEventListener('click', (event) => event.preventDefault());
    // A modified click opens the link elsewhere, so the drawer stays, past the time it takes to slide out.
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(drawer()?.hasAttribute('data-exiting')).toBe(false);
    await userEvent.click(link);
    await expect.poll(drawer).toBeNull();
  });
});

describe('props table', () => {
  const describe_ = (text: string) => ({ en: { text, lang: 'en' as const }, ko: { text, lang: 'en' as const } });
  const rows: PropsTableRow[] = [
    { name: 'onActiveValueChange', type: '(value: string | null) => void', required: true, descriptions: describe_('Called when the active option changes.') },
    {
      name: 'type',
      type: '"text" | "search" | "email" | "url" | "tel" | "password" | "number" | "date" | "time" | "datetime-local"',
      required: false,
      default: '"text"',
      descriptions: describe_('Native input type. Number, date and time keep the native spinner and picker, and value stays the input string.'),
    },
  ];

  function renderTable(width: string) {
    render(
      <Providers>
        <main style={{ inlineSize: width }}>
          <PropsTableView name="Field.TextInput" rows={rows} />
        </main>
      </Providers>,
    );
    return screen.getByRole('table', { name: 'Field.TextInput props' });
  }

  it('gives the description a readable column on a wide page, without scrolling', async () => {
    const table = renderTable('46rem');
    await frame();
    const scroller = table.parentElement!;
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
    const description = within(table).getAllByRole('row')[2]!.querySelectorAll('td')[1]!;
    expect(description.getBoundingClientRect().width).toBeGreaterThanOrEqual(16 * 16);
    expect(await violations()).toEqual([]);
  });

  it('fits every component in the schema at every main column width, without scrolling', async () => {
    render(
      <Providers>
        <main>
          {schema.components.map((component) => (
            <PropsTable key={component.name} name={component.name} />
          ))}
        </main>
      </Providers>,
    );
    const main = document.querySelector('main')!;
    const overflowing: string[] = [];
    // From a small phone up to main's widest (48rem less its padding).
    for (let rem = 18; rem <= 46; rem += 0.5) {
      // Reading scrollWidth lays the page out, container queries included.
      main.style.inlineSize = `${rem}rem`;
      for (const table of main.querySelectorAll('table')) {
        const scroller = table.parentElement!;
        if (scroller.scrollWidth > scroller.clientWidth) {
          overflowing.push(`${rem}rem ${table.caption?.textContent}: ${scroller.scrollWidth} > ${scroller.clientWidth}`);
        }
      }
    }
    expect(overflowing).toEqual([]);
  });

  it('stacks each prop on a phone, keeping table semantics and no horizontal scroll', async () => {
    const table = renderTable('22rem');
    await frame();
    const scroller = table.parentElement!;
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
    expect(scroller.hasAttribute('tabindex')).toBe(false);
    const [, first] = within(table).getAllByRole('row');
    const [name, type, description] = [within(first!).getByRole('rowheader'), ...within(first!).getAllByRole('cell')];
    // One block per prop: name, then type, then description, each under the last.
    expect(type!.getBoundingClientRect().top).toBeGreaterThan(name.getBoundingClientRect().top);
    expect(description!.getBoundingClientRect().top).toBeGreaterThan(type!.getBoundingClientRect().top);
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
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
