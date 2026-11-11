export type OneTimeCodeCharacters = 'digits' | 'alphanumeric';

const ALLOWED: Record<OneTimeCodeCharacters, RegExp> = {
  digits: /[^0-9]/g,
  alphanumeric: /[^A-Za-z0-9]/g,
};

// Full-width digits and Latin letters, which sit 0xFEE0 above their ASCII ones. Not NFKC, which also turns "½" into "12" and "①" into "1".
const FULL_WIDTH = /[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g;

/** The characters of `text` the code allows, cut to `length`. Full-width digits and letters count as their ASCII ones. */
export function cleanCode(text: string, characters: OneTimeCodeCharacters, length: number): string {
  return text
    .replace(FULL_WIDTH, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(ALLOWED[characters], '')
    .slice(0, length);
}

export type CodeSelection = { start: number; end: number };

/** Replace `value.slice(from, to)` with `insert`. */
export type CodeEdit = { from: number; to: number; insert: string };

/** `value` with `edit` made. */
export function applyEdit(value: string, { from, to, insert }: CodeEdit): string {
  return value.slice(0, from) + insert + value.slice(to);
}

/**
 * The one rule for every insert: typing, paste, drop and a finished composition.
 * A whole code replaces the value. Anything shorter replaces the selection and
 * writes over the characters after it as far as it needs room, and what still
 * doesn't fit is cut, so nothing already typed moves out of its box. Null when
 * nothing would land.
 */
export function editOf(
  value: string,
  selection: CodeSelection,
  text: string,
  { characters, length }: { characters: OneTimeCodeCharacters; length: number },
): CodeEdit | null {
  const clean = cleanCode(text, characters, Infinity);
  if (!clean) return null;
  if (clean.length >= length) return { from: 0, to: value.length, insert: clean.slice(0, length) };
  const from = Math.min(selection.start, value.length);
  const end = Math.min(Math.max(selection.end, from), value.length);
  const kept = value.length - (end - from);
  const to = Math.min(end + Math.max(clean.length - (length - kept), 0), value.length);
  const insert = clean.slice(0, Math.max(length - (value.length - (to - from)), 0));
  return insert ? { from, to, insert } : null;
}

/**
 * The edit that makes `from` into `to`: the range between their common start
 * and end, and what `to` has there. With `near`, the selection the change
 * started from, the range starts no later than its start and ends no earlier
 * than its end, so a character typed next to the same one is placed where it
 * was typed.
 */
export function difference(from: string, to: string, near?: CodeSelection): CodeEdit {
  const shorter = Math.min(from.length, to.length);
  let start = 0;
  while (start < Math.min(shorter, near?.start ?? shorter) && from[start] === to[start]) start++;
  const most = Math.min(shorter - start, near ? Math.max(from.length - near.end, 0) : Infinity);
  let end = 0;
  while (end < most && from[from.length - 1 - end] === to[to.length - 1 - end]) end++;
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) };
}

/**
 * The edit that makes `previous` into the code the field holds when its text
 * went from `previous` to `text` by an edit Todae didn't make itself
 * (autofill, an insert the browser won't let be cancelled, a composition):
 * what changed between them is taken as an insert over the range it replaced,
 * by `editOf`, and a deletion is kept as it is. `near` is the selection the
 * change started from, when it is known. Null when the insert brings nothing
 * the code allows.
 */
export function reconcileEdit(
  previous: string,
  text: string,
  options: { characters: OneTimeCodeCharacters; length: number },
  near?: CodeSelection,
): CodeEdit | null {
  const { from, to, insert } = difference(previous, text, near);
  if (!insert) return { from: 0, to: previous.length, insert: cleanCode(text, options.characters, options.length) };
  return editOf(previous, { start: from, end: to }, insert, options);
}

/** The code `reconcileEdit` gives: `previous` when the insert brings nothing the code allows. */
export function reconcile(
  previous: string,
  text: string,
  options: { characters: OneTimeCodeCharacters; length: number },
  near?: CodeSelection,
): string {
  const edit = reconcileEdit(previous, text, options, near);
  return edit ? applyEdit(previous, edit) : previous;
}

export type Slot = { active: boolean; filled: boolean; caret: boolean };

/** What each of the `length` slots shows, from the code and the input's selection (null while it has no focus). */
export function slotsOf(value: string, selection: CodeSelection | null, length: number): Slot[] {
  const collapsed = selection !== null && selection.start === selection.end;
  // A caret after a full code is in no box.
  const caretAt = selection !== null && collapsed && selection.start < length ? selection.start : -1;
  return Array.from({ length }, (_, i) => ({
    filled: i < value.length,
    active: selection !== null && (collapsed ? i === caretAt : i >= selection.start && i < selection.end),
    // Only an empty slot waiting for the next character shows the caret.
    caret: collapsed && selection.start === value.length && selection.start < length && i === selection.start,
  }));
}
