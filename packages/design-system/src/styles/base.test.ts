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
    expect(list.length).toBeGreaterThan(0);
    for (const selector of list) {
      // Only pseudo-elements, which add no specificity of their own, may follow.
      expect(selector, selector).toMatch(/^:where\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)(?:\s*>\s*:where\((?:[^()]|\([^()]*\))*\))?(?:::[a-z-]+)?$/);
    }
  });

  it('styles no native element: components carry those styles', () => {
    expect(selectors(base)).toEqual([':where(:root:has(dialog:modal))']);
  });

  it('stops page scroll, without !important, while a modal dialog is open', () => {
    expect(selectors(base)).toContain(':where(:root:has(dialog:modal))');
    const rule = base.slice(base.indexOf(':where(:root:has(dialog:modal))'));
    const body = rule.slice(rule.indexOf('{') + 1, rule.indexOf('}'));
    expect(body).toContain('overflow: hidden;');
    expect(body).not.toContain('!important');
  });

  it('only reads tokens the build declares', () => {
    const tokens = readFileSync(join(import.meta.dirname, 'tokens.generated.css'), 'utf8');
    for (const [, name] of base.matchAll(/var\((--todae-[a-z0-9-]+)\)/g)) {
      expect(tokens, name).toContain(`${name}:`);
    }
  });
});
