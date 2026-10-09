import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentsDir = join(import.meta.dirname, '..', 'components');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const sheetPaths: [string, string][] = [
  ...readdirSync(componentsDir)
    .filter((file) => file.endsWith('.module.css'))
    .map((file): [string, string] => [file.replace('.module.css', ''), join(componentsDir, file)]),
  ['base', join(import.meta.dirname, 'base.css')],
];
const sheets: Record<string, string> = Object.fromEntries(
  sheetPaths.map(([name, path]) => [name, stripComments(readFileSync(path, 'utf8'))]),
);

/** The sheet with every `@media (forced-colors: active)` block removed. */
function outsideForcedColors(css: string): string {
  let out = css;
  for (;;) {
    const start = out.indexOf('@media (forced-colors: active)');
    if (start < 0) return out;
    let depth = 0;
    let end = out.indexOf('{', start);
    for (; end < out.length; end++) {
      if (out[end] === '{') depth++;
      else if (out[end] === '}' && --depth === 0) break;
    }
    out = out.slice(0, start) + out.slice(end + 1);
  }
}

// Components read contract tokens only. These sheets still read a core
// spacing step for an anchor offset or a gap fallback.
const CORE_READS: Record<string, string[]> = {
  Popover: ['space'],
  Tooltip: ['space'],
  ChipList: ['space'],
  Field: ['space'],
};
// Contract groups every component shares.
const SHARED_ROOTS = ['overlay', 'focus'];
// Which component's tokens each sheet reads, when its name is not the root.
const OWN_ROOTS: Record<string, string[]> = {
  BottomSheet: ['sheet'],
  OptionList: ['option'],
  Label: ['field'],
  Description: ['field'],
  ErrorMessage: ['field'],
  ChipList: ['chip'],
  // Native <select> options take the OptionList look.
  Field: ['field', 'option'],
  // A toggle group is a toolbar segment and spaces its items like one.
  ToggleGroup: ['toolbar'],
  base: [
    'link',
    'disclosure',
    'separator',
    'table',
    'progress',
    'meter',
    'slider',
    'spinner',
    'skeleton',
    'code',
    'kbd',
    'text',
  ],
};

describe('token consistency across component styles', () => {
  it('reads only its own component tokens and the shared groups', () => {
    for (const [name, css] of Object.entries(sheets)) {
      const own = [...(OWN_ROOTS[name] ?? [name.toLowerCase()]), ...(CORE_READS[name] ?? [])];
      const roots = new Set([...css.matchAll(/var\(--todae-([a-z0-9]+)-/g)].map((match) => match[1] ?? ''));
      const foreign = [...roots].filter((root) => !own.includes(root) && !SHARED_ROOTS.includes(root));
      expect({ name, foreign }).toEqual({ name, foreign: [] });
    }
  });

  it('draws every focus ring from focus.ring.width and focus.ring.offset', () => {
    for (const [name, css] of Object.entries(sheets)) {
      for (const [, value] of css.matchAll(/\boutline:\s*([^;]+);/g)) {
        if (value === 'none') continue;
        // Pagination's forced-colors box around the current page is not a focus ring.
        if (name === 'Pagination' && value === '1px solid CanvasText') continue;
        expect({ name, value }).toEqual({ name, value: expect.stringMatching(/^var\(--todae-(focus-ring-width|chip-ring-width)\) solid /) });
      }
      for (const [, value] of css.matchAll(/\boutline-offset:\s*([^;]+);/g)) {
        expect({ name, value }).toEqual({
          name,
          value: expect.stringMatching(
            /^(var\(--todae-(focus-ring-offset|chip-ring-offset)\)|calc\(-1 \* var\(--todae-focus-ring-width\)\))$/,
          ),
        });
      }
    }
  });

  it('marks disabled states with color and the not-allowed cursor, never opacity', () => {
    for (const [name, css] of Object.entries(sheets)) {
      for (const [, rawSelector = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/disabled/.test(rawSelector)) continue;
        const selector = rawSelector.trim();
        expect({ name, selector, opacity: /\bopacity\s*:/.test(body) }).toEqual({ name, selector, opacity: false });
        const cursor = /\bcursor:\s*([^;]+);/.exec(body)?.[1];
        if (cursor && cursor !== 'inherit') expect({ name, selector, cursor }).toEqual({ name, selector, cursor: 'not-allowed' });
      }
    }
  });

  it('uses tokens for pills, tight leading and hairline borders', () => {
    for (const [name, css] of Object.entries(sheets)) {
      const plain = outsideForcedColors(css);
      expect({ name, pill: /\b9{3,}px/.test(plain) }).toEqual({ name, pill: false });
      expect({ name, leading: /line-height:\s*1\.25\b/.test(plain) }).toEqual({ name, leading: false });
      // Button's border stays 1px: button.base is a fixed contract (radius, padding, font, gap).
      if (name === 'Button') continue;
      expect({ name, border: /\b1px solid\b/.test(plain) }).toEqual({ name, border: false });
    }
  });
});
