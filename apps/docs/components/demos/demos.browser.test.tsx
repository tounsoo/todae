import { cleanup, render, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../../app/globals.css';
import { APPEARANCE_KEY } from '../appearanceScript';
import { Example } from '../Example';
import { Providers } from '../Providers';
import { AXE_OPTIONS, describeViolations } from '../../test/axe';
import { clippedRings } from '../../test/clippedRings';
import { paintedContrast } from '../../../../packages/design-system/src/test/paintedContrast';
import { settle } from '../../../../packages/design-system/src/test/settle';

afterEach(cleanup);

declare global {
  interface ImportMeta {
    // Vite's glob import; vite is not a direct dependency of the docs app.
    glob<T>(pattern: string[], options: { eager: true }): Record<string, T>;
  }
}

// Every demo module in this folder, where each exported component is one docs example, and every
// example file in apps/docs/examples, whose default export is one. Pages pass an example their locale.
const modules = import.meta.glob<Record<string, unknown>>(['./*Demo.tsx'], { eager: true });
const examples = import.meta.glob<{ default: ComponentType<{ locale: string }> }>(['../../examples/**/*.tsx'], { eager: true });

const demos = [
  ...Object.entries(modules).flatMap(([file, mod]) =>
    Object.entries(mod)
      .filter((entry): entry is [string, ComponentType] => /^[A-Z]/.test(entry[0]) && typeof entry[1] === 'function')
      .map(([name, Demo]) => ({ file: file.replace('./', ''), name, Demo })),
  ),
  ...Object.entries(examples).map(([file, mod]) => {
    const Shown = mod.default;
    return { file: file.replace('../../', ''), name: Shown.name, Demo: () => <Shown locale="en" /> };
  }),
];

async function violations(): Promise<string[]> {
  return describeViolations(await axe.run(document.body, AXE_OPTIONS));
}

// Every check below runs once per appearance. axe's own rules barely depend on color, so the
// painted-contrast check is what makes the dark pass catch what only dark gets wrong.
const APPEARANCES = ['light', 'dark'] as const;

const OPEN_OVERLAY = 'dialog[open], :popover-open';

/**
 * axe finds nothing, and no visible text paints below its APCA floor, in the
 * appearance showing. With `overlay`, an overlay has to be open, and the
 * contrast check has to have measured text in each open overlay that holds
 * text, so one still invisible at the start of its entry can't pass by being
 * skipped. The ColorPicker popover holds only sliders, so it has none.
 */
async function expectAccessible(appearance: (typeof APPEARANCES)[number], { overlay = false } = {}) {
  expect(document.documentElement.getAttribute('data-appearance')).toBe(appearance);
  expect(await violations()).toEqual([]);
  const { low, checked } = paintedContrast();
  expect(low).toEqual([]);
  if (!overlay) return;
  const open = [...document.querySelectorAll<HTMLElement>(OPEN_OVERLAY)];
  expect(open.length, 'no overlay open').toBeGreaterThan(0);
  for (const shown of open.filter((el) => el.innerText.trim() !== '')) {
    expect(checked.some((el) => shown.contains(el)), `no text measured in ${shown.tagName.toLowerCase()} "${shown.innerText.trim().slice(0, 30)}"`).toBe(true);
  }
}

function renderDemo(Demo: ComponentType) {
  return render(
    <Providers>
      <main>
        <Example>
          <Demo />
        </Example>
      </main>
    </Providers>,
  );
}

function demo(name: string): ComponentType {
  const found = demos.find((d) => d.name === name)?.Demo;
  expect(found, `no demo named ${name}`).toBeDefined();
  return found ?? (() => null);
}

for (const appearance of APPEARANCES) {
  describe(`${appearance} appearance`, () => {
    beforeEach(() => {
      // Providers reads the reader's pick from storage when it mounts.
      window.localStorage.setItem(APPEARANCE_KEY, appearance);
    });
    afterEach(() => {
      window.localStorage.removeItem(APPEARANCE_KEY);
      document.documentElement.removeAttribute('data-appearance');
    });

    describe('docs demos under axe', () => {
      it('found the demos', () => {
        expect(demos.length).toBeGreaterThan(40);
      });

      for (const { file, name, Demo } of demos) {
        it(`${file} ${name}`, async () => {
          renderDemo(Demo);
          await settle();
          await expectAccessible(appearance);
          // No scroll or clip container cuts a focus ring.
          expect(clippedRings()).toEqual([]);
        });
      }
    });

    // Overlays are closed on first render, so axe above never sees their contents.
    // Open each one and check again: from a combobox field when the demo has one,
    // else from its first button that says it opens a popup, else from its first button.
    describe('docs demos under axe, overlay open', () => {
      const overlayDemos = demos.filter(({ file, name }) => overlayGroup(file) && !NO_OVERLAY.has(name));

      it('found the overlay demos', () => {
        expect(new Set(overlayDemos.map((d) => overlayGroup(d.file)))).toEqual(new Set(OVERLAY_DEMOS));
      });

      for (const { file, name, Demo } of overlayDemos) {
        it(`${file} ${name}`, async () => {
          const { container } = renderDemo(Demo);
          await settle();
          await openFirstOverlay(container);
          expect(openOverlay(), 'no overlay opened').toBe(true);
          await expectAccessible(appearance, { overlay: true });
          expect(clippedRings(document.querySelector(OPEN_OVERLAY) ?? document)).toEqual([]);
        });
      }
    });

    // A Drilldown's first view is checked above. Push the next view, which slides in, and check again.
    describe('docs demos under axe, drilldown pushed', () => {
      const drilldowns = demos.filter(({ file }) => DRILLDOWN_DEMOS.some((group) => file === group || file.startsWith(group)));

      it('found the drilldown demos', () => {
        expect(drilldowns.map((d) => d.name).sort()).toEqual(['DrilldownFilterDrawer', 'DrilldownOrderSheet', 'DrilldownSettingsDialog']);
      });

      for (const { file, name, Demo } of drilldowns) {
        it(`${file} ${name}`, async () => {
          const { container } = renderDemo(Demo);
          await settle();
          await openFirstOverlay(container);
          const overlay = document.querySelector<HTMLElement>(OPEN_OVERLAY);
          expect(overlay, 'no overlay opened').not.toBeNull();
          const first = shownViews(overlay);
          expect(first).toHaveLength(1);
          const [row] = within(first[0]!).getAllByRole('button');
          await userEvent.click(row!);
          await settle();
          const shown = shownViews(overlay);
          expect(shown).toHaveLength(1);
          expect(shown[0]).not.toBe(first[0]);
          await expectAccessible(appearance, { overlay: true });
        });
      }
    });

    describe('docs demos under axe, toasts showing', () => {
      // ToastDemo keeps its toaster at module scope, and its success toast never times out, so
      // toasts outlive a test. Each test dismisses them before and after.
      it('examples/toast/ToastDemo.tsx ToastDemo', async () => {
        const { container } = renderDemo(demo('ToastDemo'));
        await clearToasts();
        // The region shows three toasts at most and holds the rest back, so the four tones show in two rounds.
        for (const [tones, titles] of [
          [['success', 'warning', 'critical'], ['Changes saved', 'Payment failed', 'You are offline']],
          [['info'], ['Draft synced']],
        ] as const) {
          for (const tone of tones) await userEvent.click(within(container).getByRole('button', { name: tone }));
          await expect.poll(() => shownToastTitles().sort()).toEqual(titles);
          await settle();
          await expectAccessible(appearance, { overlay: true });
          await clearToasts();
        }
      });

      it('examples/toast/ToastDemo.tsx ToastDemo over a dialog', async () => {
        const { container } = renderDemo(demo('ToastDemo'));
        await clearToasts();
        await userEvent.click(within(container).getByRole('button', { name: 'Open a dialog' }));
        const dialog = await within(document.body).findByRole('dialog', { name: 'Toasts over a dialog' });
        await userEvent.click(within(dialog).getByRole('button', { name: 'Show a toast' }));
        await expect.poll(() => shownToastTitles()).toEqual(['Changes saved']);
        await settle();
        await expectAccessible(appearance, { overlay: true });
        await clearToasts();
      });
    });

    describe('docs demos under axe, context menu open', () => {
      it('examples/menu/MenuContext.tsx MenuContext', async () => {
        const { container } = renderDemo(demo('MenuContext'));
        const [row] = within(container).getAllByRole('listitem');
        await userEvent.click(row!, { button: 'right' });
        await expect.poll(() => document.querySelector('[role="menu"]:popover-open')).not.toBeNull();
        await settle();
        await expectAccessible(appearance, { overlay: true });
      });
    });

    describe('docs demos under axe, tooltip open', () => {
      for (const [name, trigger] of [
        ['TooltipWarmup', 'One'],
        ['TooltipPolicy', 'Policy'],
      ] as const) {
        it(`TooltipDemo.tsx ${name}`, async () => {
          const { container } = renderDemo(demo(name));
          await userEvent.hover(within(container).getByRole('button', { name: trigger }));
          // An interactive tooltip, one that holds a link, is a non-modal dialog.
          await expect.poll(() => document.querySelector(':is([role="tooltip"], [role="dialog"]):popover-open')).not.toBeNull();
          await settle();
          await expectAccessible(appearance, { overlay: true });
        });
      }
    });

    describe('docs demos under axe, no matches', () => {
      it('ComboboxDemo.tsx ComboboxEmpty', async () => {
        const { container } = renderDemo(demo('ComboboxEmpty'));
        const field = within(container).getByRole('combobox');
        await userEvent.click(field);
        await userEvent.keyboard('zzz');
        await settle();
        expect(within(document.body).getByRole('status').textContent).toBe('No matches');
        expect(openOverlay(), 'no overlay opened').toBe(true);
        await expectAccessible(appearance, { overlay: true });
      });
    });

    // The chat composer recipe's overlays open from typing, not from a button: the suggestion list
    // after `@`, and the caret peek while the caret rests in a mention.
    describe('docs demos under axe, chat composer open', () => {
      const Composer = demos.find((d) => d.file === 'examples/recipes/chat-composer-mentions/ChatComposer.tsx')?.Demo;

      function renderComposer() {
        expect(Composer).toBeDefined();
        const { container } = renderDemo(Composer ?? (() => null));
        return within(container).getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
      }

      it('with the suggestion list open, the field points at the rendered list and option', async () => {
        const field = renderComposer();
        await userEvent.click(field);
        field.setSelectionRange(field.value.length, field.value.length);
        await userEvent.keyboard(' @mi');
        await settle();
        const list = document.getElementById(field.getAttribute('aria-controls') ?? '');
        expect(list?.getAttribute('role')).toBe('listbox');
        expect(list?.closest(':popover-open'), 'the list is not in an open popover').not.toBeNull();
        const active = document.getElementById(field.getAttribute('aria-activedescendant') ?? '');
        expect(active?.getAttribute('role')).toBe('option');
        expect(list?.contains(active ?? null)).toBe(true);
        await expectAccessible(appearance, { overlay: true });
      });

      it('with the caret peek open', async () => {
        const field = renderComposer();
        const at = field.value.indexOf('@Mina Park');
        field.focus();
        field.setSelectionRange(at + 2, at + 2);
        field.dispatchEvent(new Event('selectionchange'));
        await expect.poll(() => document.querySelector(':popover-open')?.textContent ?? '').toContain('Design systems');
        await settle();
        expect(document.activeElement).toBe(field);
        const peek = document.querySelector<HTMLElement>(':popover-open');
        await expectAccessible(appearance, { overlay: true });
        // The peek is inert, so axe skips it above. Check its content too.
        if (peek) peek.inert = false;
        expect(describeViolations(await axe.run(peek ?? document.body, AXE_OPTIONS))).toEqual([]);
      });
    });
  });
}

// Demo files, and folders of example files, whose demos open an overlay.
const OVERLAY_DEMOS = [
  'DialogDemo.tsx',
  'ComboboxDemo.tsx',
  'MenuDemo.tsx',
  'CommandPaletteDemo.tsx',
  'DateRangePresetsDemo.tsx',
  'DrilldownDemo.tsx',
  'examples/bottomsheet/',
  'examples/dialog/',
  'examples/drawer/',
  'examples/drilldown/',
  'examples/field/color-picker/',
  'examples/field/date-picker/',
  'examples/field/date-range-picker/',
  'examples/field/date-time-picker/',
  'examples/field/time-picker/',
  'examples/menu/',
  'examples/popover/',
  'examples/recipes/combobox/',
  'examples/utilities/use-popover/',
];

// Demos whose overlay holds a Drilldown.
const DRILLDOWN_DEMOS = ['DrilldownDemo.tsx', 'examples/drilldown/'];

const overlayGroup = (file: string) => OVERLAY_DEMOS.find((group) => (group.endsWith('/') ? file.startsWith(group) : file === group));

async function openFirstOverlay(container: HTMLElement) {
  const scope = within(container);
  const [field] = scope.queryAllByRole('combobox').filter((el) => el.tagName === 'INPUT');
  if (field) {
    await userEvent.click(field);
    await userEvent.keyboard('{ArrowDown}');
  } else {
    const buttons = scope.queryAllByRole('button');
    // A picker's button follows its text field, so prefer the button that says it opens a popup.
    const first = buttons.find((button) => button.hasAttribute('aria-haspopup')) ?? buttons[0];
    if (first) await userEvent.click(first);
  }
  await settle();
}

// Exports in those files that render no overlay.
const NO_OVERLAY = new Set(['PresentationBadge']);

function openOverlay(): boolean {
  return document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], :popover-open') != null;
}

/** The Drilldown views an overlay shows: not hidden below the stack, not leaving it. */
function shownViews(overlay: HTMLElement | null): HTMLElement[] {
  // A view is a labelled group that takes focus from script.
  return [...(overlay?.querySelectorAll<HTMLElement>('[role="group"][aria-label][tabindex="-1"]') ?? [])].filter(
    (view) => !view.hidden && !view.inert && view.checkVisibility(),
  );
}

const TOASTS = 'ol[aria-live] > li[data-entered]:not([data-todae-exiting])';

/** The titles of the toasts the region shows, top to bottom. */
function shownToastTitles(): string[] {
  // Toast.Title is the toast's first paragraph.
  return [...document.querySelectorAll(TOASTS)].map((toast) => toast.querySelector('p')?.textContent ?? '');
}

/** Dismisses every toast, one at a time, as the region brings held-back ones forward. */
async function clearToasts() {
  for (let left = 20; left > 0 && document.querySelector('ol[aria-live] > li'); left--) {
    // A toast that is leaving has no button to press; settling lets it go.
    const toast = document.querySelector<HTMLElement>(TOASTS);
    const [close] = toast ? within(toast).queryAllByRole('button', { name: 'Dismiss' }) : [];
    if (close) await userEvent.click(close);
    await settle();
  }
  expect(document.querySelector('ol[aria-live] > li'), 'a toast is still showing').toBeNull();
}
