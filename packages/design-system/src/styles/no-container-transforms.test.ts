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

const isKeyframes = (prelude: string) => /^@(?:-[a-z]+-)?keyframes\b/.test(prelude);

/** The pseudo-elements that hold none of the element's own children. */
const LEAF_PSEUDO =
  /::(?:-[a-z]+-)?(?:before|after|backdrop|marker|placeholder|selection|file-selector-button|first-letter|first-line)$/;

/** The last compound of a selector: what it styles. */
function subject(selector: string): string {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(ch)) start = i + 1;
  }
  return selector.slice(start);
}

/** The list inside a compound that is only :where(…) or :is(…), else null. */
function wrappedIn(compound: string): string | null {
  const open = /^:(?:where|is)\(/.exec(compound);
  if (!open) return null;
  let depth = 1;
  for (let i = open[0].length; i < compound.length; i++) {
    if (compound[i] === '(') depth++;
    else if (compound[i] === ')' && --depth === 0) {
      return i === compound.length - 1 ? compound.slice(open[0].length, i) : null;
    }
  }
  return null;
}

/**
 * A selector whose subject has no element inside it that could be a trigger:
 * a pseudo-element such as ::before or ::backdrop, a <progress>, which
 * renders none of its children, or a [data-todae-glyph] wrapper, which holds
 * only an aria-hidden glyph. :where() and :is() are looked through; any
 * other functional pseudo-class, such as :has(progress), is not the subject.
 */
function isLeaf(part: string): boolean {
  const compound = subject(part.trim());
  if (LEAF_PSEUDO.test(compound)) return true;
  const inner = wrappedIn(compound);
  if (inner !== null) return splitTopLevel(inner).every(isLeaf);
  return /^(?:progress(?![\w-])|\[data-todae-glyph\])/.test(compound);
}

/** Walks the sheet, calling `visit` with each declaration and the blocks it is in, outermost first. */
function walk(css: string, visit: (text: string, stack: readonly Block[]) => void): void {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack: Block[] = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') {
      stack.push({ prelude: clean.slice(start, i).trim().replace(/\s+/g, ' ') });
      start = i + 1;
    } else if (ch === ';' || ch === '}') {
      visit(clean.slice(start, i), stack);
      if (ch === '}') stack.pop();
      start = i + 1;
    }
  }
}

/** A declaration's property, without a vendor prefix, and its value. */
function parse(text: string): { property: string; value: string } | null {
  const match = /^\s*(?:-[a-z]+-)?([a-z-]+)\s*:([\s\S]*)$/.exec(text);
  return match ? { property: match[1]!, value: match[2]!.trim() } : null;
}

/** The names of the @keyframes in `css` that have a transform-like declaration. */
function movingKeyframes(css: string): Set<string> {
  const moving = new Set<string>();
  walk(css, (text, stack) => {
    const keyframes = stack.find((b) => isKeyframes(b.prelude));
    const declaration = parse(text);
    if (keyframes && declaration && MOVES.has(declaration.property)) {
      moving.add(keyframes.prelude.replace(/^@\S+\s+/, ''));
    }
  });
  return moving;
}

/** A sheet can run keyframes another sheet defines, so collect them from every sheet. */
const MOVING_KEYFRAMES = new Set(sheets.flatMap(({ css }) => [...movingKeyframes(css)]));

/**
 * Every transform-like declaration on an element that could hold a trigger,
 * as "selector { declaration }": outside @keyframes, or an animation that
 * runs @keyframes with one.
 */
function containerMoves(css: string, moving = movingKeyframes(css)): string[] {
  const out: string[] = [];
  walk(css, (text, stack) => {
    const declaration = parse(text);
    if (!declaration || stack.some((b) => isKeyframes(b.prelude))) return;
    const { property, value } = declaration;
    const moves =
      MOVES.has(property) ||
      ((property === 'animation' || property === 'animation-name') &&
        value.split(/[\s,]+/).some((token) => moving.has(token)));
    if (!moves) return;
    const rule = [...stack].reverse().find((b) => !b.prelude.startsWith('@'));
    const parts = rule ? splitTopLevel(rule.prelude) : [];
    if (parts.length > 0 && parts.every(isLeaf)) return;
    out.push(`${rule?.prelude ?? '(top level)'} { ${text.trim()} }`);
  });
  return out;
}

describe('design-system styles', () => {
  it('reads every component sheet', () => {
    expect(sheets.length).toBeGreaterThan(10);
  });

  // A tooltip sits in the top layer, placed against its trigger's
  // untransformed box, so a container that holds a trigger moves by layout.
  it.each(sheets)('$name moves no element by a transform, outside pseudo-elements and @keyframes', ({ css }) => {
    expect(containerMoves(css, MOVING_KEYFRAMES)).toEqual([]);
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

  it('finds a prefixed transform and one an animation runs, and allows ::backdrop and <progress>', () => {
    expect(
      containerMoves(`
        .a { -webkit-transform: none; }
        .b::backdrop { translate: 0 10%; }
        .c { animation: spin 1s linear infinite; }
        .d { animation-name: fade, spin; }
        .e { animation: fade 1s; }
        :where(progress.spinner:indeterminate) { animation: spin 1s; }
        @keyframes spin { to { transform: rotate(1turn); } }
        @keyframes fade { to { opacity: 0; } }
      `),
    ).toEqual([
      '.a { -webkit-transform: none }',
      '.c { animation: spin 1s linear infinite }',
      '.d { animation-name: fade, spin }',
    ]);
  });

  it('counts only the subject as a leaf: not progress inside :not() or :has(), nor ::details-content', () => {
    expect(
      containerMoves(`
        .a:not(progress) { translate: 0 4px; }
        .b:has(progress) { translate: 0 4px; }
        .c:has(> progress) { translate: 0 4px; }
        :is(.d, progress) { translate: 0 4px; }
        details::details-content { translate: 0 -4px; }
        .e progress, :is(progress.f, .g::marker) { translate: 0 4px; }
        :where(.h) :where(progress) { translate: 0 4px; }
      `),
    ).toEqual([
      '.a:not(progress) { translate: 0 4px }',
      '.b:has(progress) { translate: 0 4px }',
      '.c:has(> progress) { translate: 0 4px }',
      ':is(.d, progress) { translate: 0 4px }',
      'details::details-content { translate: 0 -4px }',
    ]);
  });
});
