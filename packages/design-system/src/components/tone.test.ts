import { describe, expect, it } from 'vitest';
import { CATEGORY_TONES, categoryTone } from './tone';

describe('categoryTone', () => {
  it('gives the same key the same tone', () => {
    expect(categoryTone('ada@example.com')).toBe(categoryTone('ada@example.com'));
    expect(categoryTone('')).toBe(categoryTone(''));
  });

  it('pins tones, so a key keeps its color across releases', () => {
    expect(['', 'a', 'Ada Lovelace', '에이다'].map(categoryTone)).toEqual([
      'category-6',
      'category-5',
      'category-7',
      'category-8',
    ]);
  });

  it('spreads keys over all eight tones', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => categoryTone(`user-${i}`)));
    expect([...seen].sort()).toEqual([...CATEGORY_TONES]);
  });
});
