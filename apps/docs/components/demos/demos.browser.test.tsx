import { cleanup, render, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import '@omsoo.design/todae/todae.css';
import '../../app/globals.css';
import { Example } from '../Example';
import { Providers } from '../Providers';
import { clippedRings } from '../../test/clippedRings';

afterEach(cleanup);

declare global {
  interface ImportMeta {
    // Vite's glob import; vite is not a direct dependency of the docs app.
    glob<T>(pattern: string[], options: { eager: true }): Record<string, T>;
  }
}

// Every demo module in this folder; each exported component is one docs example.
const modules = import.meta.glob<Record<string, unknown>>(['./*Demo.tsx'], { eager: true });

const demos = Object.entries(modules).flatMap(([file, mod]) =>
  Object.entries(mod)
    .filter((entry): entry is [string, ComponentType] => /^[A-Z]/.test(entry[0]) && typeof entry[1] === 'function')
    .map(([name, Demo]) => ({ file: file.replace('./', ''), name, Demo })),
);

/**
 * axe's color-contrast rule is WCAG 2; Todae checks contrast with APCA when
 * tokens build, so that rule is off here.
 */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map(
    (v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  );
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
  const overlayDemos = demos.filter(({ file, name }) => OVERLAY_DEMOS.has(file) && !NO_OVERLAY.has(name));

  it('found the overlay demos', () => {
    expect(new Set(overlayDemos.map((d) => d.file))).toEqual(OVERLAY_DEMOS);
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

const OVERLAY_DEMOS = new Set(['BottomSheetDemo.tsx', 'DialogDemo.tsx', 'DrawerDemo.tsx', 'PopoverDemo.tsx', 'ComboboxDemo.tsx', 'MenuDemo.tsx', 'CommandPaletteDemo.tsx']);

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
