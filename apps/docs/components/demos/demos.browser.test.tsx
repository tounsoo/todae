import { cleanup, render, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../../app/globals.css';
import { Example } from '../Example';
import { Providers } from '../Providers';
import { AXE_OPTIONS, describeViolations } from '../../test/axe';
import { clippedRings } from '../../test/clippedRings';

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

describe('docs demos under axe', () => {
  it('found the demos', () => {
    expect(demos.length).toBeGreaterThan(40);
  });

  for (const { file, name, Demo } of demos) {
    it(`${file} ${name}`, async () => {
      render(
        <Providers>
          <main>
            <Example>
              <Demo />
            </Example>
          </main>
        </Providers>,
      );
      await settle();
      expect(await violations()).toEqual([]);
      // No scroll or clip container cuts a focus ring.
      expect(clippedRings()).toEqual([]);
    });
  }
});

// Overlays are closed on first render, so axe above never sees their contents.
// Open each one and check again: from a combobox field when the demo has one,
// else from its first button.
describe('docs demos under axe, overlay open', () => {
  const overlayDemos = demos.filter(({ file, name }) => overlayGroup(file) && !NO_OVERLAY.has(name));

  it('found the overlay demos', () => {
    expect(new Set(overlayDemos.map((d) => overlayGroup(d.file)))).toEqual(new Set(OVERLAY_DEMOS));
  });

  for (const { file, name, Demo } of overlayDemos) {
    it(`${file} ${name}`, async () => {
      const { container } = render(
        <Providers>
          <main>
            <Example>
              <Demo />
            </Example>
          </main>
        </Providers>,
      );
      await settle();
      await openFirstOverlay(container);
      expect(openOverlay(), 'no overlay opened').toBe(true);
      expect(await violations()).toEqual([]);
      expect(clippedRings(document.querySelector('dialog[open], :popover-open') ?? document)).toEqual([]);
    });
  }
});

describe('docs demos under axe, no matches', () => {
  it('ComboboxDemo.tsx ComboboxEmpty', async () => {
    const Demo = demos.find((d) => d.name === 'ComboboxEmpty')?.Demo;
    expect(Demo).toBeDefined();
    if (!Demo) return;
    const { container } = render(
      <Providers>
        <main>
          <Example>
            <Demo />
          </Example>
        </main>
      </Providers>,
    );
    const field = within(container).getByRole('combobox');
    await userEvent.click(field);
    await userEvent.keyboard('zzz');
    await settle();
    expect(within(document.body).getByRole('status').textContent).toBe('No matches');
    expect(openOverlay(), 'no overlay opened').toBe(true);
    expect(await violations()).toEqual([]);
  });
});

// The chat composer recipe's overlays open from typing, not from a button: the suggestion list
// after `@`, and the caret peek while the caret rests in a mention.
describe('docs demos under axe, chat composer open', () => {
  const Composer = demos.find((d) => d.file === 'examples/recipes/chat-composer-mentions/ChatComposer.tsx')?.Demo;

  function renderComposer() {
    expect(Composer).toBeDefined();
    const { container } = render(
      <Providers>
        <main>
          <Example>{Composer ? <Composer /> : null}</Example>
        </main>
      </Providers>,
    );
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
    expect(await violations()).toEqual([]);
  });

  it('with the caret peek open', async () => {
    const field = renderComposer();
    const at = field.value.indexOf('@Mina Park');
    field.focus();
    field.setSelectionRange(at + 2, at + 2);
    field.dispatchEvent(new Event('selectionchange'));
    await expect.poll(() => document.querySelector(':popover-open')?.textContent ?? '').toContain('Design systems');
    expect(document.activeElement).toBe(field);
    const peek = document.querySelector<HTMLElement>(':popover-open');
    expect(await violations()).toEqual([]);
    // The peek is inert, so axe skips it above. Check its content too.
    if (peek) peek.inert = false;
    expect(describeViolations(await axe.run(peek ?? document.body, AXE_OPTIONS))).toEqual([]);
  });
});

// Demo files, and folders of example files, whose demos open an overlay.
const OVERLAY_DEMOS = [
  'DialogDemo.tsx',
  'ComboboxDemo.tsx',
  'MenuDemo.tsx',
  'CommandPaletteDemo.tsx',
  'examples/bottomsheet/',
  'examples/dialog/',
  'examples/drawer/',
  'examples/menu/',
  'examples/popover/',
  'examples/recipes/combobox/',
  'examples/utilities/use-popover/',
];

const overlayGroup = (file: string) => OVERLAY_DEMOS.find((group) => (group.endsWith('/') ? file.startsWith(group) : file === group));

async function openFirstOverlay(container: HTMLElement) {
  const scope = within(container);
  const [field] = scope.queryAllByRole('combobox').filter((el) => el.tagName === 'INPUT');
  if (field) {
    await userEvent.click(field);
    await userEvent.keyboard('{ArrowDown}');
  } else {
    const [first] = scope.queryAllByRole('button');
    if (first) await userEvent.click(first);
  }
  await settle();
}

// Exports in those files that render no overlay.
const NO_OVERLAY = new Set(['PresentationBadge']);

function openOverlay(): boolean {
  return document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], :popover-open') != null;
}

// Let effects, measurement, anchored layout and entry transitions settle.
async function settle() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
