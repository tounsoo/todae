export type OneTimeCodeCharacters = 'digits' | 'alphanumeric';

const ALLOWED: Record<OneTimeCodeCharacters, RegExp> = {
  digits: /[^0-9]/g,
  alphanumeric: /[^A-Za-z0-9]/g,
};

/** The characters of `text` the code allows, cut to `length`. The one rule that typing, paste and autofill share. */
export function cleanCode(text: string, characters: OneTimeCodeCharacters, length: number): string {
  return text.replace(ALLOWED[characters], '').slice(0, length);
}

export type CodeSelection = { start: number; end: number };

export type Slot = { active: boolean; filled: boolean; caret: boolean };

/** What each of the `length` slots shows, from the code and the input's selection (null while it has no focus). */
export function slotsOf(value: string, selection: CodeSelection | null, length: number): Slot[] {
  const collapsed = selection !== null && selection.start === selection.end;
  const caretAt = selection !== null && collapsed ? Math.min(selection.start, length - 1) : -1;
  return Array.from({ length }, (_, i) => ({
    filled: i < value.length,
    active: selection !== null && (collapsed ? i === caretAt : i >= selection.start && i < selection.end),
    // Only an empty slot waiting for the next character shows the caret.
    caret: collapsed && selection.start === value.length && selection.start < length && i === selection.start,
  }));
}
