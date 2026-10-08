import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const base = readFileSync(join(import.meta.dirname, 'base.css'), 'utf8');
const todae = readFileSync(join(import.meta.dirname, 'todae.css'), 'utf8');

/** Splits a selector list on the commas that are not inside parentheses. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts;
}

/** Every style rule's selector list, with comments and at-rule preludes left out. */
function selectors(css: string): string[] {
  const out: string[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of clean.matchAll(/([^{};]+)\{/g)) {
    const prelude = match[1]!.trim();
    if (prelude.startsWith('@')) continue;
    // Keyframe stops (from, to, 50%) are not selectors.
    if (/^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(prelude)) continue;
    out.push(...splitTopLevel(prelude));
  }
  return out;
}

describe('todae.base styles', () => {
  it('sit in the todae.base layer and load with the package CSS', () => {
    expect(base).toMatch(/^[\s\S]*?@layer todae\.base \{/);
    expect(todae).toContain("@import './base.css';");
  });

  it('wrap every selector in :where(), so a company class always wins', () => {
    const list = selectors(base);
    expect(list.length).toBeGreaterThan(5);
    for (const selector of list) {
      // Only pseudo-elements, which add no specificity of their own, may follow.
      expect(selector, selector).toMatch(/^:where\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)(?:\s*>\s*:where\((?:[^()]|\([^()]*\))*\))?(?:::[a-z-]+)?$/);
    }
  });

  it('stops page scroll, without !important, while a modal dialog is open', () => {
    expect(selectors(base)).toContain(':where(:root:has(dialog:modal))');
    const rule = base.slice(base.indexOf(':where(:root:has(dialog:modal))'));
    const body = rule.slice(rule.indexOf('{') + 1, rule.indexOf('}'));
    expect(body).toContain('overflow: hidden;');
    expect(body).not.toContain('!important');
  });

  it('styles links, disclosures and the visually hidden utilities', () => {
    const list = selectors(base).join('\n');
    expect(list).toContain(':where(a:any-link)');
    expect(list).toContain(':where(summary)');
    expect(list).toContain(':where(details)::details-content');
    expect(list).toContain(':where(.todae-visually-hidden, .todae-visually-hidden-focusable:not(:focus-within))');
  });

  it('styles separators, tables, progress, meters and sliders', () => {
    const list = selectors(base).join('\n');
    for (const selector of [
      ':where(hr)',
      ':where(table)',
      ':where(thead th)',
      ':where(progress, meter)',
      ':where(progress)::-webkit-progress-value',
      ':where(progress)::-moz-progress-bar',
      ':where(progress:indeterminate)',
      ':where(meter)::-webkit-meter-optimum-value',
      ':where(meter:-moz-meter-sub-sub-optimum)::-moz-meter-bar',
      ":where(input[type='range'])",
    ]) {
      expect(list).toContain(selector);
    }
    expect(base).toMatch(/prefers-reduced-motion: reduce\) \{\s*:where\(progress:indeterminate\) \{\s*animation: none;/);
  });

  it('styles spinners and skeletons, and stops them under reduced motion', () => {
    const list = selectors(base);
    for (const selector of [
      ':where(progress.todae-spinner:indeterminate)',
      ':where(progress.todae-spinner:indeterminate)::-webkit-progress-bar',
      ':where(progress.todae-spinner:indeterminate)::-webkit-progress-value',
      ':where(progress.todae-spinner:indeterminate)::-moz-progress-bar',
      ':where(.todae-skeleton)',
      ':where(.todae-skeleton > *)',
    ]) {
      expect(list).toContain(selector);
    }
    // Same specificity as the progress rules, so the spinner must come after
    // every one of them, the forced-colors block included.
    const lastProgress = list.reduce(
      (last, selector, i) => (/^:where\((progress|meter)\b/.test(selector) && !selector.includes('todae-spinner') ? i : last),
      -1,
    );
    expect(lastProgress).toBeGreaterThan(0);
    expect(list.indexOf(':where(progress.todae-spinner:indeterminate)')).toBeGreaterThan(lastProgress);
    expect(base).toMatch(/prefers-reduced-motion: reduce\) \{\s*:where\(progress\.todae-spinner:indeterminate\) \{\s*animation: none;/);
    expect(base).toMatch(/prefers-reduced-motion: reduce\) \{\s*:where\(\.todae-skeleton\) \{\s*animation: none;/);
    expect(base).toMatch(/forced-colors: active\) \{\s*:where\(progress\.todae-spinner:indeterminate\) \{\s*forced-color-adjust: none;/);
    expect(base).toMatch(/forced-colors: active\) \{\s*:where\(\.todae-skeleton\) \{\s*forced-color-adjust: none;\s*background: GrayText;/);
    // The ring draws in the text color, so it shows inside a primary button.
    const spinner = base.slice(base.indexOf(':where(progress.todae-spinner:indeterminate) {'));
    expect(spinner.slice(0, spinner.indexOf('}'))).toContain('currentColor 0 25%');
  });

  it('tints inline code from the text color, lightly, and gives blocks their own colors', () => {
    const code = base.slice(base.indexOf(':where(code) {'));
    const rule = code.slice(0, code.indexOf('}'));
    expect(rule).not.toMatch(/\bcolor:/);
    expect(rule).toContain('color-mix(in oklch, currentColor calc(var(--todae-code-tint) * 100%), transparent)');
    // A light tint keeps the pair close to the text and surface around it,
    // which the resolver's contrast list cannot check for a color-mix.
    const tokens = JSON.parse(readFileSync(join(import.meta.dirname, '../../tokens/components/code.json'), 'utf8'));
    expect(tokens.code.tint.$value).toBeLessThanOrEqual(0.15);
    const pre = base.slice(base.indexOf(':where(pre) {'));
    expect(pre.slice(0, pre.indexOf('}'))).toContain('color: var(--todae-code-block-fg);');
  });

  it('styles code, code blocks and keys', () => {
    const list = selectors(base);
    for (const selector of [':where(code)', ':where(pre)', ':where(pre code)', ':where(kbd)', ':where(kbd:has(kbd, samp))']) {
      expect(list).toContain(selector);
    }
    // The outer <kbd> of a shortcut and the <code> in a <pre> undo the box,
    // so they must follow the rules they undo.
    expect(list.indexOf(':where(kbd:has(kbd, samp))')).toBeGreaterThan(list.indexOf(':where(kbd)'));
    expect(list.indexOf(':where(pre code)')).toBeGreaterThan(list.indexOf(':where(code)'));
  });

  it('only reads tokens the build declares', () => {
    const tokens = readFileSync(join(import.meta.dirname, 'tokens.generated.css'), 'utf8');
    for (const [, name] of base.matchAll(/var\((--todae-[a-z0-9-]+)\)/g)) {
      expect(tokens, name).toContain(`${name}:`);
    }
  });
});
