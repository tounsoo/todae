import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../../app/globals.css';
import { Example } from '../Example';
import { Providers } from '../Providers';

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
      // Let effects, measurement and anchored layout settle.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      expect(await violations()).toEqual([]);
    });
  }
});
