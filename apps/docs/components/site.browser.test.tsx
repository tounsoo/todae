/// <reference types="@vitest/browser/providers/playwright" />
import { cleanup, render, screen, within } from '@testing-library/react';
import { cdp, page, userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../app/globals.css';
import { APPEARANCE_KEY, APPEARANCE_SCRIPT } from './appearanceScript';
import { HomeContent } from './HomeContent';
import { MobileNav } from './MobileNav';
import { Playground } from './Playground';
import { Providers } from './Providers';
import { PropsTable } from './PropsTable';
import { PropsTableView, type PropsTableRow } from './PropsTableView';
import schema from '@tounsoo/todae/schema/components.json';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Sidebar } from './Sidebar';
import { SiteFooter } from './SiteFooter';
import { clippedRings } from '../test/clippedRings';

afterEach(cleanup);

// The playground copies its JSON here; a test can make it fail.
const writeText = vi.fn<(text: string) => Promise<void>>();
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

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
    await page.viewport(1280, 800);
    render(
      <Providers>
        <main>
          <Playground locale="en" />
        </main>
      </Providers>,
    );
    await frame();
    expect(await violations()).toEqual([]);
    await userEvent.click(screen.getByText('Porcelain'));
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

  function renderNarrowPlayground(locale: 'en' | 'ko' = 'en') {
    render(
      <Providers>
        <main>
          <Playground locale={locale} />
        </main>
        {/* SiteShell's footer comes after the playground on every page. */}
        <SiteFooter locale={locale} />
      </Providers>,
    );
    return {
      stage: screen.getByRole('region', { name: locale === 'en' ? 'Preview' : '미리보기' }),
      bar: document.querySelector<HTMLElement>('.pg-sheet-bar')!,
    };
  }

  it('puts the playground stage right under its title and every control in a sheet', async () => {
    await page.viewport(390, 800);
    const { stage, bar } = renderNarrowPlayground();
    await frame();
    // Every control is in the sheet, and the stage follows the title and lead.
    expect(screen.queryByRole('tab', { name: 'raw' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Porcelain' })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    const lead = screen.getByText(/Start from a preset/);
    expect(stage.getBoundingClientRect().top).toBeGreaterThanOrEqual(lead.getBoundingClientRect().bottom);
    expect(stage.getBoundingClientRect().top).toBeLessThan(innerHeight / 3);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
    // The page keeps the bar's height free at its end, under the stage and the footer.
    expect(getComputedStyle(document.querySelector('.shell')!).paddingBlockEnd).toBe(
      `${Math.ceil(bar.getBoundingClientRect().height)}px`,
    );
    // The border box is measured, so padding such as the safe area counts too.
    const reserved = () => document.documentElement.style.getPropertyValue('--docs-pg-bar');
    const idle = reserved();
    bar.style.paddingBlockEnd = '3rem';
    await expect.poll(reserved).toBe(`${Math.ceil(bar.getBoundingClientRect().height)}px`);
    bar.style.paddingBlockEnd = '';
    await expect.poll(reserved).toBe(idle);
    expect(await violations()).toEqual([]);
    await userEvent.click(within(bar).getByRole('button', { name: 'Edit theme' }));
    const sheet = await screen.findByRole('dialog', { name: 'Theme controls' });
    await frame();
    expect(await violations()).toEqual([]);
    // Nothing in the sheet, including the sideways preset row, cuts a focus ring.
    expect(clippedRings(sheet)).toEqual([]);
    // The export hint the rail shows on wide screens describes the sheet here.
    expect(sheet.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(sheet.getAttribute('aria-describedby')!)?.textContent).toContain('light and dark differ');
    await userEvent.fill(within(sheet).getByLabelText('color.accent.default'), 'oklch(0.5 0.1 30)');
    expect(stage.style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.5 0.1 30)');
    // Presets and modes are in the sheet too, and change the stage behind it.
    await userEvent.click(within(sheet).getByRole('button', { name: 'dark' }));
    expect(stage.getAttribute('data-appearance')).toBe('dark');
    // The presets scroll in their own row, so the sheet does not scroll sideways.
    const body = sheet.querySelector<HTMLElement>('.pg-sheet-body')!;
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
    const row = sheet.querySelector<HTMLElement>('.preset-scroll')!;
    expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
    await userEvent.click(within(sheet).getByRole('button', { name: 'light' }));
    // The count shows on the button that opens the sheet, and names the change for a screen reader.
    expect(within(bar).getByRole('button', { name: 'Edit theme (1 changed)' })).toBeTruthy();
    // The stage fills the room above the sheet while tokens change.
    const box = stage.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeLessThan(innerHeight / 4);
    expect(box.bottom).toBeGreaterThan(sheet.getBoundingClientRect().top);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Close theme controls' }));
    await expect.poll(() => screen.queryByRole('dialog', { name: 'Theme controls' })).toBeNull();
  });

  it('keeps the page still when focus moves onto the playground bar or back to it', async () => {
    await page.viewport(390, 800);
    const { stage, bar } = renderNarrowPlayground();
    await frame();
    stage.scrollIntoView({ block: 'start' });
    await frame();
    const still = scrollY;
    const edit = within(bar).getByRole('button', { name: 'Edit theme' });
    edit.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(within(bar).getByRole('button', { name: 'Copy JSON' }));
    await frame();
    expect(scrollY).toBe(still);
    await userEvent.click(edit);
    await screen.findByRole('dialog', { name: 'Theme controls' });
    await frame();
    expect(scrollY).toBe(still);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => screen.queryByRole('dialog', { name: 'Theme controls' })).toBeNull();
    // Focus goes back to the button that opened the sheet, without moving the page.
    await expect.poll(() => document.activeElement).toBe(edit);
    await frame();
    expect(scrollY).toBe(still);
  });

  it('keeps focus and the end of the stage clear of the playground bar at its tallest', async () => {
    await page.viewport(320, 700);
    // The failure text is the longer status, so the bar wraps to its tallest.
    writeText.mockRejectedValue(new Error('denied'));
    const { stage, bar } = renderNarrowPlayground();
    await userEvent.click(within(bar).getByRole('button', { name: 'Copy JSON' }));
    await expect.poll(() => bar.textContent).toContain('Could not copy');
    await frame();
    const barTop = () => bar.getBoundingClientRect().top;
    // A control on screen, entirely behind the bar.
    const target = within(stage).getByRole('button', { name: 'Upgrade to Pro' });
    scrollBy(0, target.getBoundingClientRect().top - barTop() - 4);
    await frame();
    expect(target.getBoundingClientRect().top).toBeGreaterThan(barTop());
    expect(target.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight);
    target.focus();
    await frame();
    expect(target.getBoundingClientRect().bottom).toBeLessThanOrEqual(barTop());
    // The end of the page, the stage and the footer after it, scrolls clear of the bar.
    scrollTo(0, document.documentElement.scrollHeight);
    await frame();
    expect(stage.getBoundingClientRect().bottom).toBeLessThanOrEqual(barTop() + 1);
    const footer = document.querySelector<HTMLElement>('.site-footer')!;
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(barTop() + 1);
    // The footer's last link, scrolled behind the bar, scrolls clear of it on focus.
    const link = within(footer).getByRole('link', { name: 'Changelog' });
    scrollBy(0, link.getBoundingClientRect().top - barTop() - 4);
    await frame();
    expect(link.getBoundingClientRect().top).toBeGreaterThan(barTop());
    link.focus();
    await frame();
    expect(link.getBoundingClientRect().bottom).toBeLessThanOrEqual(barTop());
  });

  it('ends the stage at the playground bar on a screen taller than the page', async () => {
    await page.viewport(390, 6000);
    // With the top bar, as on the site, since the stage's height leaves room for it.
    render(
      <Providers>
        <header className="topbar">
          <div className="topbar-inner" />
        </header>
        <main>
          <Playground locale="en" />
        </main>
      </Providers>,
    );
    const bar = document.querySelector<HTMLElement>('.pg-sheet-bar')!;
    await frame();
    // The stage's backdrop grows to fill the screen, and stops where the bar starts.
    const backdrop = document.querySelector('.pg-stage-theme')!.getBoundingClientRect();
    const barTop = bar.getBoundingClientRect().top;
    expect(document.documentElement.scrollHeight).toBeGreaterThan(innerHeight);
    expect(backdrop.bottom).toBeLessThanOrEqual(barTop + 1);
    expect(backdrop.bottom).toBeGreaterThan(barTop - 2);
  });

  it('leaves the playground bar, the open sheet and their space out of print', async () => {
    await page.viewport(390, 800);
    // Static markup with the playground's classes: printing can also flip the
    // playground's own media query, and this checks the stylesheet alone.
    document.documentElement.style.setProperty('--docs-pg-bar', '80px');
    render(
      <div className="shell">
        <div className="playground">
          <div className="pg-sheet-bar" />
          <dialog className="pg-sheet" open />
        </div>
      </div>,
    );
    const shell = document.querySelector<HTMLElement>('.shell')!;
    expect(getComputedStyle(shell).paddingBlockEnd).toBe('80px');
    await cdp().send('Emulation.setEmulatedMedia', { media: 'print' });
    try {
      expect(getComputedStyle(document.querySelector('.pg-sheet-bar')!).display).toBe('none');
      expect(getComputedStyle(document.querySelector('.pg-sheet')!).display).toBe('none');
      expect(getComputedStyle(shell).paddingBlockEnd).toBe('0px');
    } finally {
      await cdp().send('Emulation.setEmulatedMedia', { media: '' });
      document.documentElement.style.removeProperty('--docs-pg-bar');
    }
  });

  it('keeps the playground sheet open after printing', async () => {
    await page.viewport(390, 800);
    const { bar } = renderNarrowPlayground();
    await userEvent.click(within(bar).getByRole('button', { name: 'Edit theme' }));
    await screen.findByRole('dialog', { name: 'Theme controls' });
    await cdp().send('Emulation.setEmulatedMedia', { media: 'print' });
    try {
      await frame();
    } finally {
      await cdp().send('Emulation.setEmulatedMedia', { media: '' });
    }
    await frame();
    expect(screen.getByRole('dialog', { name: 'Theme controls' })).toBeTruthy();
  });

  it('names the playground sheet controls in Korean on the Korean page', async () => {
    await page.viewport(390, 800);
    const { bar } = renderNarrowPlayground('ko');
    await userEvent.click(within(bar).getByRole('button', { name: '테마 편집' }));
    const sheet = await screen.findByRole('dialog', { name: '테마 컨트롤' });
    expect(within(sheet).getAllByRole('button', { name: '테마 컨트롤 크기 조절' })).toHaveLength(1);
    expect(within(sheet).getByRole('button', { name: '테마 컨트롤 닫기' })).toBeTruthy();
  });
});

describe('site footer', () => {
  const lines = () => {
    const [license, release, copyright] = [...document.querySelectorAll<HTMLElement>('.site-footer-inner > *')].map((line) =>
      line.getBoundingClientRect(),
    );
    const inner = document.querySelector<HTMLElement>('.site-footer-inner')!;
    const padding = parseFloat(getComputedStyle(inner).paddingInlineEnd);
    return { license: license!, release: release!, copyright: copyright!, end: inner.getBoundingClientRect().right - padding };
  };

  // A sweep, since where the lines wrap depends on the language and the version.
  it('ends a shared line with the copyright, and starts the copyright’s own line, at every width', async () => {
    const shared: string[] = [];
    for (const locale of ['en', 'ko'] as const) {
      render(<SiteFooter locale={locale} />);
      for (let width = 320; width <= 1280; width += 40) {
        await page.viewport(width, 600);
        await frame();
        const { license, release, copyright, end } = lines();
        const at = `${locale} at ${width}px`;
        if (copyright.top < release.bottom) {
          shared.push(at);
          expect(Math.abs(copyright.right - end), at).toBeLessThan(1);
        } else {
          expect(copyright.left, at).toBe(license.left);
        }
      }
      cleanup();
    }
    // Both cases come up, the shared line on a screen narrower than a tablet too.
    expect(shared).toContain('ko at 720px');
    expect(shared).toContain('en at 1280px');
    expect(shared).not.toContain('en at 320px');
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
    expect(drawer()?.hasAttribute('data-todae-exiting')).toBe(false);
    await userEvent.click(link);
    await expect.poll(drawer).toBeNull();
  });
});

describe('props table', () => {
  const describe_ = (text: string) => ({ en: { text, lang: 'en' as const }, ko: { text, lang: 'en' as const } });
  const rows: PropsTableRow[] = [
    {
      name: 'onActiveValueChange',
      type: '(value: string | null) => void',
      required: true,
      descriptions: describe_('Called when the active option changes.'),
    },
    {
      name: 'type',
      type: '"text" | "search" | "email" | "url" | "tel" | "password" | "number" | "date" | "time" | "datetime-local"',
      required: false,
      default: '"text"',
      descriptions: describe_(
        'Native input type. Number, date and time keep the native spinner and picker, and value stays the input string.',
      ),
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
    const scroller = table.closest<HTMLElement>('[data-scroll-kind]')!;
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
        const scroller = table.closest<HTMLElement>('[data-scroll-kind]')!;
        if (scroller.scrollWidth > scroller.clientWidth) {
          overflowing.push(`${rem}rem ${table.caption?.textContent}: ${scroller.scrollWidth} > ${scroller.clientWidth}`);
        }
      }
    }
    expect(overflowing).toEqual([]);
    // Every table in the schema at 57 widths: its time grows with the schema.
  }, 60_000);

  it('stacks each prop on a phone, keeping table semantics and no horizontal scroll', async () => {
    const table = renderTable('22rem');
    await frame();
    const scroller = table.closest<HTMLElement>('[data-scroll-kind]')!;
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

describe('focus rings in the site scroll containers', () => {
  it('keeps every sidebar link ring whole', async () => {
    await page.viewport(1280, 600);
    render(
      <Providers>
        <div className="layout">
          <Sidebar locale="en" />
          <main />
        </div>
      </Providers>,
    );
    await frame();
    // The sidebar scrolls, so the last links start out of view and are scrolled in on focus.
    const sidebar = document.querySelector<HTMLElement>('.sidebar-scroll')!;
    expect(sidebar.scrollHeight).toBeGreaterThan(sidebar.clientHeight);
    expect(clippedRings(sidebar)).toEqual([]);
  });

  it('keeps every ring in the playground rail whole', async () => {
    await page.viewport(1280, 800);
    render(
      <Providers>
        <main>
          <Playground locale="en" />
        </main>
      </Providers>,
    );
    await frame();
    expect(clippedRings(screen.getByRole('complementary', { name: 'Theme controls' }))).toEqual([]);
  });
});

describe('playground stage', () => {
  // The token editor sits in the rail on wide screens.
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

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
    await userEvent.click(screen.getByText('Acid'));
    await frame();
    expect(getComputedStyle(stage).fontFamily).toContain('ui-monospace');
    expect(getComputedStyle(screen.getByRole('button', { name: 'Copy JSON' })).fontFamily).not.toContain('ui-monospace');
    expect(getComputedStyle(document.querySelector('.shell') as Element).fontFamily).toContain('ui-sans-serif');
  });

  it('scrolls the Invoices table sideways on a phone instead of cutting it off', async () => {
    await page.viewport(390, 800);
    const stage = renderPlayground();
    await frame();
    const area = within(stage).getByRole('region', { name: 'Invoices' });
    expect(area.scrollWidth).toBeGreaterThan(area.clientWidth);
    expect(getComputedStyle(area).overflowX).not.toBe('hidden');
    area.scrollLeft = area.scrollWidth;
    expect(area.scrollLeft).toBeGreaterThan(0);
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
