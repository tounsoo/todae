// Kept free of hooks and 'use client', so server-safe parts can import it.

export const CATEGORY_TONES = [
  'category-1',
  'category-2',
  'category-3',
  'category-4',
  'category-5',
  'category-6',
  'category-7',
  'category-8',
] as const;

/** One of the eight color.category hues, for labels, tags and people. */
export type CategoryTone = (typeof CATEGORY_TONES)[number];

/**
 * The category tone for a key such as a user id or a tag name. The same key
 * always gets the same tone, on the server and in every browser.
 */
export function categoryTone(key: string): CategoryTone {
  // Composed and decomposed forms of the same text get the same tone.
  const text = String(key).normalize('NFC');
  // 32-bit FNV-1a over UTF-16 code units.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // FNV-1a's low bits see only the low bits of each code unit, so 'a' and 'i'
  // would share a tone. MurmurHash3's finalizer mixes every bit in first.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return CATEGORY_TONES[(hash >>> 0) % CATEGORY_TONES.length]!;
}
