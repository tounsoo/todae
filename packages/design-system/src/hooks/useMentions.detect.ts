/** A committed token: a range of the text that a pick inserted. */
export type MentionToken = {
  /** Index of the token's first character in the text. */
  start: number;
  /** Index just past the token's last character. */
  end: number;
  /** The trigger character that started it, such as `@`. */
  char: string;
  /** The value of the option that was picked. */
  value: string;
  /** The inserted text, such as `@Ada Lovelace`. A token whose range no longer holds this text is dropped. */
  text: string;
};

export type MentionTriggerPosition = 'word' | 'start';

export type DetectTrigger = { char: string; position?: MentionTriggerPosition };

/** The word being typed after a trigger character. */
export type MentionQuery = {
  /** Index of the trigger in `triggers`. */
  trigger: number;
  /** Index of the trigger character in the text. */
  start: number;
  /** Index just past the word. */
  end: number;
  /** The text after the trigger character, up to the end of the word. */
  query: string;
};

const SPACE = /\s/;

/**
 * The trigger word the caret is in, if any. The word runs from a trigger
 * character to the next whitespace. With `position: 'word'` the trigger sits
 * at the start of the text or after whitespace; with `'start'` only
 * whitespace comes before it. The nearest trigger character before the caret
 * that may start a word there starts it. A word inside a committed token is
 * not one.
 */
export function findQuery(
  text: string,
  caret: number,
  triggers: readonly DetectTrigger[],
  tokens: readonly MentionToken[],
): MentionQuery | null {
  if (caret < 0 || caret > text.length) return null;
  let start = caret - 1;
  while (start >= 0 && !SPACE.test(text[start]!)) {
    const trigger = triggers.findIndex((item) => item.char === text[start]);
    if (trigger !== -1) {
      const position = triggers[trigger]!.position ?? 'word';
      const before = text.slice(0, start);
      const allowed = position === 'start' ? before.trim() === '' : start === 0 || SPACE.test(before[before.length - 1]!);
      // A trigger character that can't start a word here is part of the word,
      // such as the slash in `@src/index`: look further back.
      if (!allowed) {
        start -= 1;
        continue;
      }
      let end = caret;
      while (end < text.length && !SPACE.test(text[end]!)) end += 1;
      if (tokens.some((token) => token.start < end && start < token.end)) return null;
      return { trigger, start, end, query: text.slice(start + 1, end) };
    }
    start -= 1;
  }
  return null;
}

type Span = { from: number; prevTo: number; nextTo: number };

/**
 * The changed span between two texts: where the change starts, and where it
 * ends in each. With the caret after the edit, the span that ends at the
 * caret wins, so typing `@` right before `@Bob` is an insertion before the
 * token, not inside it. Without one, or when the texts don't fit it, the
 * longest common start and end decide.
 */
function changedSpan(prev: string, next: string, caret?: number | null): Span {
  if (caret != null) {
    const nextTo = caret;
    const prevTo = caret - (next.length - prev.length);
    if (nextTo >= 0 && nextTo <= next.length && prevTo >= 0 && prevTo <= prev.length && prev.slice(prevTo) === next.slice(nextTo)) {
      const limit = Math.min(prevTo, nextTo);
      let from = 0;
      while (from < limit && prev[from] === next[from]) from += 1;
      return { from, prevTo, nextTo };
    }
  }
  const limit = Math.min(prev.length, next.length);
  let from = 0;
  while (from < limit && prev[from] === next[from]) from += 1;
  let tail = 0;
  while (tail < limit - from && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
  return { from, prevTo: prev.length - tail, nextTo: next.length - tail };
}

/**
 * Moves the character at `index` through an edit from `prev` to `next`: one
 * before the change stays, one after it shifts by the change in length, and
 * one the change replaced or removed is gone.
 */
export function shiftIndex(prev: string, next: string, index: number, caret?: number | null): number | null {
  if (prev === next) return index;
  const { from, prevTo, nextTo } = changedSpan(prev, next, caret);
  if (index < from) return index;
  if (index >= prevTo) return index + (nextTo - prevTo);
  return null;
}

/**
 * Carries tokens through an edit from `prev` to `next`. Tokens before the
 * change stay, tokens after it shift, and tokens the change touches are
 * dropped. Every token left must still hold its own text. `caret` is where
 * the caret is after the edit, when the edit came from typing.
 */
export function shiftTokens(
  prev: string,
  next: string,
  tokens: readonly MentionToken[],
  caret?: number | null,
): MentionToken[] {
  if (prev === next) return validTokens(next, tokens);
  const { from, prevTo, nextTo } = changedSpan(prev, next, caret);
  const delta = nextTo - prevTo;
  const moved: MentionToken[] = [];
  for (const token of tokens) {
    if (token.end <= from) moved.push(token);
    else if (token.start >= prevTo) moved.push({ ...token, start: token.start + delta, end: token.end + delta });
  }
  return validTokens(next, moved);
}

/** The tokens whose range holds their text, in order, without overlaps. */
export function validTokens(text: string, tokens: readonly MentionToken[]): MentionToken[] {
  const sorted = [...tokens].sort((a, b) => a.start - b.start);
  const kept: MentionToken[] = [];
  for (const token of sorted) {
    if (token.start < 0 || token.end > text.length || token.end <= token.start) continue;
    if (text.slice(token.start, token.end) !== token.text) continue;
    const last = kept[kept.length - 1];
    if (last && token.start < last.end) continue;
    kept.push(token);
  }
  return kept;
}

export function sameTokens(a: readonly MentionToken[], b: readonly MentionToken[]): boolean {
  return (
    a.length === b.length &&
    a.every((token, i) => {
      const other = b[i]!;
      return (
        token.start === other.start &&
        token.end === other.end &&
        token.char === other.char &&
        token.value === other.value &&
        token.text === other.text
      );
    })
  );
}
