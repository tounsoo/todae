import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Under prefers-reduced-motion: reduce nothing slides, scales, rises or turns,
// but opacity and color fades keep their tokens, since they move nothing
// (ARCHITECTURE.md, Motion). This catches a sheet that turns a fade off there.

const components = join(import.meta.dirname, '..', 'components');
const sheets = readdirSync(components)
  .filter((name) => name.endsWith('.css'))
  .map((name) => ({ name: `components/${name}`, css: readFileSync(join(components, name), 'utf8') }));

/** Properties whose transition only fades: it changes how something looks, never where it is or how big. */
const FADES = new Set(['opacity', 'color', 'background-color', 'border-color', 'outline-color', 'fill', 'stroke', 'text-decoration-color']);

const REDUCE = /(?<!not\s*\()prefers-reduced-motion:\s*reduce/;
const NO_PREFERENCE = /prefers-reduced-motion:\s*no-preference/;

/** Splits on the commas that are not inside parentheses. */
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

/** Splits on the spaces that are not inside parentheses. */
function tokens(item: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of item) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) out.push(current);
      current = '';
    } else current += ch;
  }
  if (current) out.push(current);
  return out;
}

const NOT_A_PROPERTY =
  /^(?:-?[\d.]+m?s|ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|allow-discrete|normal|initial|inherit|unset|(?:cubic-bezier|steps|linear)\(.*)$/;

/**
 * The properties a `transition` or `transition-property` value runs, or null
 * when a custom property hides them. `none` runs none, and a shorthand item
 * that names no property runs `all`.
 */
function transitioned(property: string, value: string): Set<string> | null {
  if (value.trim() === 'none') return new Set();
  const names = new Set<string>();
  for (const item of splitTopLevel(value)) {
    const words = tokens(item);
    if (words.some((word) => word.startsWith('var('))) {
      const named = words.filter((word) => !word.startsWith('var(') && !NOT_A_PROPERTY.test(word));
      if (property === 'transition-property' || named.length === 0) return null;
      named.forEach((name) => names.add(name));
      continue;
    }
    const named = property === 'transition-property' ? words : words.filter((word) => !NOT_A_PROPERTY.test(word));
    names.add(named[0] ?? 'all');
  }
  return names;
}

type Rule = { media: string[]; parts: string[]; property: string; value: string };

/** Every transition and transition-property declaration, with the @media preludes around it and its selector list. */
function transitions(css: string): Rule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack: string[] = [];
  const out: Rule[] = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') {
      stack.push(clean.slice(start, i).trim().replace(/\s+/g, ' '));
      start = i + 1;
    } else if (ch === ';' || ch === '}') {
      const match = /^\s*(transition(?:-property)?)\s*:([\s\S]*)$/.exec(clean.slice(start, i));
      const rule = [...stack].reverse().find((prelude) => !prelude.startsWith('@'));
      if (match && rule) {
        out.push({
          media: stack.filter((prelude) => prelude.startsWith('@media')),
          parts: splitTopLevel(rule),
          property: match[1]!,
          value: match[2]!.trim(),
        });
      }
      if (ch === '}') stack.pop();
      start = i + 1;
    }
  }
  return out;
}

/**
 * Each fade a sheet turns off for reduced motion, as "selector: property": a
 * reduce block whose transition on a selector drops a fade the same selector
 * runs outside it, or a no-preference rule that runs nothing but fades. A selector
 * is matched as written, so a reduce rule that names its elements another way
 * goes unchecked, and so does one that only sets durations.
 */
function droppedFades(css: string): string[] {
  const rules = transitions(css);
  const outside = new Map<string, Set<string>>();
  const out: string[] = [];
  for (const rule of rules) {
    if (rule.media.some((m) => REDUCE.test(m))) continue;
    const names = transitioned(rule.property, rule.value);
    if (!names) continue;
    const fades = [...names].filter((name) => FADES.has(name));
    if (rule.media.some((m) => NO_PREFERENCE.test(m))) {
      // One that also moves something may carry a fade along with it.
      if (fades.length > 0 && fades.length === names.size) {
        for (const fade of fades) out.push(`${rule.parts.join(', ')}: ${fade} only without reduced motion`);
      }
      continue;
    }
    for (const part of rule.parts) {
      const set = outside.get(part) ?? new Set<string>();
      fades.forEach((fade) => set.add(fade));
      outside.set(part, set);
    }
  }
  for (const rule of rules) {
    if (!rule.media.some((m) => REDUCE.test(m))) continue;
    const kept = transitioned(rule.property, rule.value);
    if (!kept || kept.has('all')) continue;
    for (const part of rule.parts) {
      for (const fade of outside.get(part) ?? []) {
        if (!kept.has(fade)) out.push(`${part}: ${fade}`);
      }
    }
  }
  return out;
}

describe('reduced motion keeps fades', () => {
  it('reads every component sheet', () => {
    expect(sheets.length).toBeGreaterThan(10);
  });

  it.each(sheets)('$name turns no opacity or color fade off under reduced motion', ({ css }) => {
    expect(droppedFades(css)).toEqual([]);
  });

  it('finds a fade a reduce block turns off, or one only no-preference runs', () => {
    expect(
      droppedFades(`
        @layer x {
          .a { transition: opacity 1s, inset-inline-start 1s; }
          .b { transition: background-color var(--d) var(--e); }
          .c { transition-property: color, rotate; }
          .d { transition: rotate 1s; }
          @media (prefers-reduced-motion: no-preference) {
            .e { transition: opacity 1s; }
            .f { transition: rotate 1s; }
            .g[data-moving] { transition: opacity 1s, inset 1s; }
          }
          @media not (prefers-reduced-motion: reduce) { .h { transition: opacity 1s; } }
          @media (prefers-reduced-motion: reduce) {
            .h { transition: none; }
            .a, .b { transition: none; }
            .c { transition-property: rotate; }
            .d { transition: none; }
          }
        }
      `),
    ).toEqual(['.e: opacity only without reduced motion', '.h: opacity', '.a: opacity', '.b: background-color', '.c: color']);
  });

  it('allows a reduce block that keeps the fade and drops only the motion', () => {
    expect(
      droppedFades(`
        .a { transition: opacity 1s, inset-block-start 1s; }
        .b { transition: opacity 1s ease-in, visibility 0s linear 1s; }
        .c { transition: var(--whole); }
        @media (prefers-reduced-motion: reduce) {
          .a { transition-property: opacity; }
          .b { transition: all 1s; }
          .c { transition: none; }
          .d { transition: none; }
        }
      `),
    ).toEqual([]);
  });
});
