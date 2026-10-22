export type OneTimeCodeCharacters = 'digits' | 'alphanumeric';

const ALLOWED: Record<OneTimeCodeCharacters, RegExp> = {
  digits: /[^0-9]/g,
  alphanumeric: /[^A-Za-z0-9]/g,
};

/** The characters of `text` the code allows, cut to `length`. Full-width digits and letters count as their ASCII ones. */
export function cleanCode(text: string, characters: OneTimeCodeCharacters, length: number): string {
  return text.normalize('NFKC').replace(ALLOWED[characters], '').slice(0, length);
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
