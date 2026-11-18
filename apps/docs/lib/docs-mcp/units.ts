import { slugOf } from '../remarkPageContents.mjs';

export const SOURCE = 'todae-docs' as const;

/**
 * chars/4. The same unit the page-size audit used. A model tokenizer lands a
 * little higher, so a budget written in this unit stays under the client's.
 */
export function tokensOf(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Case, space and dash fold into one slug form. */
export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const STOP = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'for', 'and', 'or', 'on', 'with', 'from', 'that', 'this',
  'how', 'do', 'does', 'what', 'is', 'are', 'be', 'it', 'its', 'as', 'by', 'at', 'your', 'you',
  'when', 'which', 'can', 'not', 'into', 'about', 'than', 'then', 'them', 'their',
]);

/** Identifiers such as isDateDisabled and useLaneDrag become words search can share. */
export function splitIdent(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[._/\\#]+/g, ' ');
}

function termKeys(word: string): string[] {
  const keys = new Set<string>([word]);
  if (word.length > 5 && word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    keys.add(stem);
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) keys.add(stem.slice(0, -1));
  }
  if (word.length > 4 && word.endsWith('ed')) keys.add(word.slice(0, -2));
  if (word.length > 4 && word.endsWith('es')) keys.add(word.slice(0, -2));
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) keys.add(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('e')) keys.add(word.slice(0, -1));
  return [...keys];
}

/** Search terms for `text`, with a light stem so "dragging" and "drag" meet. */
export function tokenize(text: string): string[] {
  const words = splitIdent(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOP.has(word));
  const out: string[] = [];
  for (const word of words) out.push(...termKeys(word));
  return out;
}

/** The heading id the docs page uses, so a slug#anchor from the site opens the same section. */
export function headingAnchor(text: string, seen: Set<string>): string {
  return slugOf(text, seen);
}

export function snippet(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}
