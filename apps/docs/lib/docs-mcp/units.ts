import { slugOf } from '../headingSlug.mjs';

export const SOURCE = 'todae-docs' as const;

/**
 * chars/4. The same unit the page-size audit used. A real o200k tokenizer is
 * about 1.00 to 1.12 times this for the English text these tools return.
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
  return words.flatMap(termKeys);
}

/** Insertions, deletions and substitutions. Used for a miss, not for ranking. */
export function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  const gap = Math.abs(left.length - right.length);
  if (gap > 3) return gap;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const next = left[i - 1] === right[j - 1] ? diagonal : Math.min(diagonal, row[j]!, row[j - 1]!) + 1;
      diagonal = row[j]!;
      row[j] = next;
    }
  }
  return row[right.length] ?? gap;
}

function nameForms(name: string): string[] {
  const norm = normalizeSlug(name);
  return [...new Set([norm, norm.replace(/\./g, ''), ...name.split('.').map((part) => normalizeSlug(part))])];
}

/** Names within two edits of `query`, closest first. `Calendar.Root` for `calender`. */
export function closeNames(query: string, names: readonly string[], limit = 5): string[] {
  const norm = normalizeSlug(query);
  if (norm.length < 3) return [];
  const seen = new Set<string>();
  return names
    .map((name) => ({ name, distance: Math.min(...nameForms(name).map((form) => editDistance(norm, form))) }))
    .filter((row) => row.distance > 0 && row.distance <= 2)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .filter((row) => (seen.has(row.name) ? false : (seen.add(row.name), true)))
    .slice(0, limit)
    .map((row) => row.name);
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
