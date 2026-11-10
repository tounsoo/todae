/** How long a typeahead search waits for the next character before it starts over. */
const TYPEAHEAD_RESET_MS = 500;

/** What a list has typed so far, and when the last character came. */
export type TypeaheadBuffer = { text: string; at: number };

export const emptyTypeahead = (): TypeaheadBuffer => ({ text: '', at: 0 });

/** Whether a key is one typed character, so an emoji counts too. */
export const isTypeaheadKey = (key: string): boolean => [...key].length === 1;

/** Whether a search is under way at `timeStamp`, when a Space adds to it instead of choosing. */
export const typingAhead = (buffer: TypeaheadBuffer, timeStamp: number): boolean =>
  buffer.text !== '' && timeStamp - buffer.at <= TYPEAHEAD_RESET_MS;

/**
 * Adds `key` to the search in `buffer` and returns the index of the item it
 * finds among `count` items, or -1. `text` reads an item's lowercased,
 * trimmed text, only as far as the search needs.
 * `index` is the current item, or -1 for none, and `after` the first item
 * after the current place. One letter, or the same letter repeated, cycles
 * through the items that start with it from `after`; a longer prefix keeps
 * matching the current item. A failed search ends, so the next key starts a
 * new one.
 */
export function findTypeahead(
  buffer: TypeaheadBuffer,
  key: string,
  timeStamp: number,
  count: number,
  text: (index: number) => string,
  index: number,
  after: number,
): number {
  buffer.text = timeStamp - buffer.at > TYPEAHEAD_RESET_MS ? key : buffer.text + key;
  buffer.at = timeStamp;
  const query = buffer.text.toLowerCase();
  const chars = [...query];
  const cycling = chars.every((char) => char === chars[0]);
  const needle = cycling ? (chars[0] ?? query) : query;
  const start = cycling || index < 0 ? after : index;
  for (let step = 0; step < count; step++) {
    const at = (start + step) % count;
    if (text(at).startsWith(needle)) return at;
  }
  buffer.text = '';
  return -1;
}
