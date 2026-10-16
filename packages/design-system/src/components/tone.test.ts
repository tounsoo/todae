import { describe, expect, it } from 'vitest';
import { CATEGORY_TONES, categoryTone } from './tone.js';

describe('categoryTone', () => {
  it('gives the same key the same tone', () => {
    expect(categoryTone('ada@example.com')).toBe(categoryTone('ada@example.com'));
    expect(categoryTone('')).toBe(categoryTone(''));
  });

  it('pins tones, so a key keeps its color across releases', () => {
    expect(['', 'a', 'Ada Lovelace', '에이다'].map(categoryTone)).toEqual([
      'category-4',
      'category-4',
      'category-3',
      'category-4',
    ]);
  });

  it('spreads keys over all eight tones', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => categoryTone(`user-${i}`)));
    expect([...seen].sort()).toEqual([...CATEGORY_TONES]);
  });

  it('separates keys that differ only in the high bits of one character', () => {
    // Plain FNV-1a modulo 8 maps each of these sets to one tone.
    expect(new Set(['a', 'i', 'q', 'y'].map(categoryTone)).size).toBeGreaterThan(1);
    expect(categoryTone('user-1')).not.toBe(categoryTone('user-9'));
    expect(categoryTone('10')).not.toBe(categoryTone('18'));
  });

  it('gives composed and decomposed text the same tone', () => {
    expect(categoryTone('José'.normalize('NFD'))).toBe(categoryTone('José'.normalize('NFC')));
    expect(categoryTone('에이다'.normalize('NFD'))).toBe(categoryTone('에이다'));
  });
});
