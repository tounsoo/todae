import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const components = join(import.meta.dirname, '..', 'components');
const sheets = [
  ...readdirSync(components)
    .filter((name) => name.endsWith('.css'))
    .map((name) => ({ name: `components/${name}`, css: readFileSync(join(components, name), 'utf8') })),
  { name: 'styles/base.css', css: readFileSync(join(import.meta.dirname, 'base.css'), 'utf8') },
];

const MOVES = new Set(['transform', 'translate', 'scale', 'rotate']);

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

type Block = { prelude: string };

/**
 * Every transform-like declaration that is neither in @keyframes nor on a
 * pseudo-element, as "selector { declaration }".
 */
function containerMoves(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack: Block[] = [];
  const out: string[] = [];
  let start = 0;
  const declaration = (text: string) => {
    const match = /^\s*([a-z-]+)\s*:([\s\S]*)$/.exec(text);
    if (!match || !MOVES.has(match[1]!)) return;
    if (stack.some((b) => b.prelude.startsWith('@keyframes') || b.prelude.startsWith('@-webkit-keyframes'))) return;
    const rule = [...stack].reverse().find((b) => !b.prelude.startsWith('@'));
    const parts = rule ? splitTopLevel(rule.prelude) : [];
    if (parts.length > 0 && parts.every((part) => /::(?:before|after)$/.test(part))) return;
    out.push(`${rule?.prelude ?? '(top level)'} { ${text.trim()} }`);
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') {
      stack.push({ prelude: clean.slice(start, i).trim().replace(/\s+/g, ' ') });
      start = i + 1;
    } else if (ch === ';') {
      declaration(clean.slice(start, i));
      start = i + 1;
    } else if (ch === '}') {
      declaration(clean.slice(start, i));
      stack.pop();
      start = i + 1;
    }
  }
  return out;
}

describe('design-system styles', () => {
  it('reads every component sheet', () => {
    expect(sheets.length).toBeGreaterThan(10);
  });

  // A tooltip sits in the top layer, placed against its trigger's
  // untransformed box, so a container that holds a trigger moves by layout.
  it.each(sheets)('$name moves no element by a transform, outside pseudo-elements and @keyframes', ({ css }) => {
    expect(containerMoves(css)).toEqual([]);
  });

  it('finds a transform on an element, nested or not, and allows pseudo-elements and keyframes', () => {
    expect(
      containerMoves(`
        @layer x {
          .a { transform: none; }
          .b::after, .c::before { transform: rotate(45deg); }
          .d::after, .e { rotate: 45deg; }
          .f { @starting-style { scale: 0.9; } }
          .g { transition: transform 1s; }
          @keyframes spin { to { transform: rotate(1turn); } }
        }
      `),
    ).toEqual(['.a { transform: none }', '.d::after, .e { rotate: 45deg }', '.f { scale: 0.9 }']);
  });
});
