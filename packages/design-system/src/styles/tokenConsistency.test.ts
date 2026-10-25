import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_TONES } from '../components/tone.js';

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
  // Progress and meter share one sheet.
  Progress: ['progress', 'meter'],
  ScrollArea: ['scroll'],
  ColorPicker: ['picker'],
  // A code block reads code.block and the font Code.Root shares.
  CodeBlock: ['code'],
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

  it('draws Prose type from prose font-size tokens', () => {
    const css = sheets.Prose ?? '';
    expect(css).not.toMatch(/--todae-font-size-/);
    expect(css).toContain('font-size: var(--todae-prose-font-size)');
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(css).toContain(`font-size: var(--todae-prose-h${level}-font-size)`);
    }
  });

  it('names the custom properties a sheet sets for itself --_<name>, not like a token', () => {
    for (const [name, css] of Object.entries(sheets)) {
      const declared = [...css.matchAll(/(?:^|[{;\s])(--todae-[a-z0-9-]+)\s*:/g)].map((match) => match[1]);
      expect({ name, declared }).toEqual({ name, declared: [] });
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

  // revealRing finds a ring on the focused element or an ancestor by itself.
  // A ring drawn on any other element must be marked data-todae-focus-ring
  // where the component renders it; revealRing.browser.test.tsx checks each.
  it('marks every focus ring drawn off the focused element and its ancestors', () => {
    /** The compound selector a complex selector styles: what follows its last combinator. */
    const subject = (selector: string) => {
      let depth = 0;
      let start = 0;
      for (const [i, c] of [...selector].entries()) {
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (depth === 0 && /[\s>+~]/.test(c)) start = i + 1;
      }
      return selector.slice(start);
    };
    const splitList = (list: string) => {
      const parts: string[] = [];
      let depth = 0;
      let start = 0;
      for (const [i, c] of [...list].entries()) {
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ',' && depth === 0) {
          parts.push(list.slice(start, i));
          start = i + 1;
        }
      }
      return [...parts, list.slice(start)].map((part) => part.trim().replace(/\s+/g, ' '));
    };
    const offElement: Record<string, string[]> = {};
    for (const [name, css] of Object.entries(sheets)) {
      for (const [, list = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/\boutline:\s*(?!none\b)/.test(body)) continue;
        for (const selector of splitList(list)) {
          if (selector.includes(':focus') && !subject(selector).includes(':focus')) (offElement[name] ??= []).push(selector);
        }
      }
    }
    expect(offElement).toEqual({
      Field: [
        '.oneTimeCodeInput:focus-visible + .slots',
        '.oneTimeCodeInput:focus-visible + .slots[data-active]',
        '.oneTimeCodeInput:focus-visible + .slots .slot[data-active]',
      ],
      selection: ['.input:focus-visible + .indicator'],
      ColorPicker: ['.area:has(.axis:focus-visible) > .thumb'],
      Tree: ['.item:focus-visible > .label'],
      ChipList: ['.more:focus-visible [data-overflow]'],
    });
    const renderedIn: Record<string, string> = {
      Field: 'Field.OneTimeCode',
      selection: 'SelectionControl',
      ColorPicker: 'ColorPicker',
      Tree: 'Tree',
      ChipList: 'ChipList',
    };
    for (const [name, file] of Object.entries(renderedIn)) {
      const source = readFileSync(join(componentsDir, `${file}.tsx`), 'utf8');
      expect({ name, marked: source.includes('data-todae-focus-ring=""') }).toEqual({ name, marked: true });
    }
  });

  it('colors every focus ring token from focus.ring.color', () => {
    const generated = JSON.parse(readFileSync(join(import.meta.dirname, '../../tokens/tokens.generated.json'), 'utf8')) as {
      tokens: { path: string; ref: string | null }[];
    };
    const rings = generated.tokens.filter((token) => token.path.endsWith('.ring.focus'));
    expect(rings.length).toBeGreaterThan(10);
    for (const { path, ref } of rings) expect({ path, ref }).toEqual({ path, ref: 'focus.ring.color' });
  });

  it('never fades a disabled state, and gives it no cursor but not-allowed', () => {
    for (const [name, css] of Object.entries(sheets)) {
      for (const [, rawSelector = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        // `:not(:disabled)` and the like select enabled states.
        if (!/disabled/.test(rawSelector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, ''))) continue;
        const selector = rawSelector.trim();
        expect({ name, selector, opacity: /\bopacity\s*:/.test(body) }).toEqual({ name, selector, opacity: false });
        const cursor = /\bcursor:\s*([^;]+);/.exec(body)?.[1];
        if (cursor && cursor !== 'inherit') expect({ name, selector, cursor }).toEqual({ name, selector, cursor: 'not-allowed' });
      }
    }
  });

  it('uses tokens for pills, leading, fades, easing and hairline borders', () => {
    for (const [name, css] of Object.entries(sheets)) {
      const plain = outsideForcedColors(css);
      expect({ name, pill: /\b9{3,}px/.test(plain) }).toEqual({ name, pill: false });
      // line-height: 1 centres a glyph in its box; any other number is text leading.
      expect({ name, leading: /line-height:\s*(?!1\s*[;}])[\d.]+\s*[;}]/.test(plain) }).toEqual({ name, leading: false });
      // opacity 0 and 1 show and hide; a value between is a look a theme may change.
      expect({ name, fade: /\bopacity:\s*(?:0?\.\d+|0\.0*[1-9]\d*)\s*[;}]/.test(plain) }).toEqual({ name, fade: false });
      // linear stays for continuous loops; a named curve is a motion style.
      expect({ name, easing: /\b(?:ease|ease-in|ease-out|ease-in-out)\b(?![-\w])/.test(plain) }).toEqual({ name, easing: false });
      const hairline = /\bborder[-a-z]*:[^;]*\b1px\b|calc\([^;]*\b1px\b/.test(plain);
      expect({ name, hairline }).toEqual({ name, hairline: false });
    }
  });

  it('lifts every overlay surface with its own shadow token', () => {
    const surfaces: [string, string][] = [
      ['Dialog', 'dialog'],
      ['BottomSheet', 'sheet'],
      ['Drawer', 'drawer'],
      ['Popover', 'popover'],
      ['Tooltip', 'tooltip'],
      ['Toast', 'toast'],
      ['Field', 'field-picker'],
    ];
    for (const [name, token] of surfaces) {
      expect({ name, reads: sheets[name]!.includes(`box-shadow: var(--todae-${token}-shadow);`) }).toEqual({ name, reads: true });
    }
  });

  it('keeps overrides of the tokens a component used to read reaching it', () => {
    const tokensCss = readFileSync(join(import.meta.dirname, 'tokens.generated.css'), 'utf8');
    const pairs = [
      ['field-picker-bg', 'popover-bg'],
      ['field-picker-fg', 'popover-fg'],
      ['field-picker-border', 'popover-border'],
      ['field-picker-radius', 'popover-radius'],
      ['field-picker-padding-x', 'popover-padding-x'],
      ['field-picker-padding-y', 'popover-padding-y'],
      ['field-picker-max-height', 'popover-max-height'],
      ['field-picker-shadow', 'popover-shadow'],
      ['sheet-shadow', 'dialog-shadow'],
      ['drawer-shadow', 'dialog-shadow'],
      ['drawer-gap', 'dialog-gap'],
      ['sheet-title-font-size', 'dialog-title-font-size'],
      ['sheet-title-font-weight', 'dialog-title-font-weight'],
      ['drawer-title-font-size', 'dialog-title-font-size'],
      ['drawer-title-font-weight', 'dialog-title-font-weight'],
    ];
    for (const [token, previous] of pairs) {
      expect(tokensCss).toContain(`--todae-${token}: var(--_todae-${token}, var(--todae-${previous}));`);
    }
  });

  it('styles every tone a component takes, from tokens that exist', () => {
    const tokensCss = readFileSync(join(import.meta.dirname, 'tokens.generated.css'), 'utf8');
    const status = ['info', 'success', 'warning', 'critical'];
    const toned: [sheet: string, tones: readonly string[], parts: string[]][] = [
      ['Badge', [...status, ...CATEGORY_TONES], ['fg', 'bg', 'border']],
      ['Chip', [...status, ...CATEGORY_TONES], ['fg', 'bg', 'border']],
      ['Avatar', CATEGORY_TONES, ['fg', 'bg']],
      ['Alert', status, ['fg', 'bg', 'border']],
      ['Toast', status, ['fg', 'bg', 'border']],
    ];
    for (const [sheet, tones, parts] of toned) {
      const root = sheet.toLowerCase();
      for (const tone of tones) {
        expect({ sheet, tone, styled: sheets[sheet]?.includes(`.root[data-tone='${tone}']`) }).toEqual({ sheet, tone, styled: true });
        for (const part of parts) expect(tokensCss).toContain(`--todae-${root}-${tone}-${part}:`);
      }
    }
  });
});
