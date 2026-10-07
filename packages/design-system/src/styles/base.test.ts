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

  it('styles links, disclosures and the visually hidden utilities', () => {
    const list = selectors(base).join('\n');
    expect(list).toContain(':where(a:any-link)');
    expect(list).toContain(':where(summary)');
    expect(list).toContain(':where(details)::details-content');
    expect(list).toContain(':where(.todae-visually-hidden, .todae-visually-hidden-focusable:not(:focus-within))');
  });

  it('only reads tokens the build declares', () => {
    const tokens = readFileSync(join(import.meta.dirname, 'tokens.generated.css'), 'utf8');
    for (const [, name] of base.matchAll(/var\((--todae-[a-z0-9-]+)\)/g)) {
      expect(tokens, name).toContain(`${name}:`);
    }
  });
});
