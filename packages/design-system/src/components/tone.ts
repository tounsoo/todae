// Kept free of hooks and 'use client', so server-safe parts can import it.

/** One of the eight color.category hues, for labels, tags and people. */
export type CategoryTone =
  | 'category-1'
  | 'category-2'
  | 'category-3'
  | 'category-4'
  | 'category-5'
  | 'category-6'
  | 'category-7'
  | 'category-8';

export const CATEGORY_TONES = [
  'category-1',
  'category-2',
  'category-3',
  'category-4',
  'category-5',
  'category-6',
  'category-7',
  'category-8',
] as const satisfies readonly CategoryTone[];

/**
 * The category tone for a key such as a user id or a tag name. The same key
 * always gets the same tone, on the server and in every browser.
 */
export function categoryTone(key: string): CategoryTone {
  // 32-bit FNV-1a over UTF-16 code units.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return CATEGORY_TONES[(hash >>> 0) % CATEGORY_TONES.length]!;
}
