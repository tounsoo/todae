import { describe, expect, it } from 'vitest';
import { paginationRange, type PaginationRangeItem } from './paginationRange.js';

describe('paginationRange', () => {
  it('lists every page when they fit', () => {
    expect(paginationRange({ page: 2, count: 5 })).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange({ page: 4, count: 7 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('puts a gap on the far side near either end, and on both sides in the middle', () => {
    expect(paginationRange({ page: 1, count: 20 })).toEqual([1, 2, 3, 4, 5, 'end-ellipsis', 20]);
    expect(paginationRange({ page: 10, count: 20 })).toEqual([1, 'start-ellipsis', 9, 10, 11, 'end-ellipsis', 20]);
    expect(paginationRange({ page: 20, count: 20 })).toEqual([1, 'start-ellipsis', 16, 17, 18, 19, 20]);
  });

  it('shows a page instead of a gap that would stand for only one', () => {
    expect(paginationRange({ page: 4, count: 9 })).toEqual([1, 2, 3, 4, 5, 'end-ellipsis', 9]);
    expect(paginationRange({ page: 5, count: 9 })).toEqual([1, 'start-ellipsis', 4, 5, 6, 'end-ellipsis', 9]);
  });

  it('clamps the page and handles empty or odd input', () => {
    expect(paginationRange({ page: 99, count: 3 })).toEqual([1, 2, 3]);
    expect(paginationRange({ page: -2, count: 3 })).toEqual([1, 2, 3]);
    expect(paginationRange({ page: 1, count: 0 })).toEqual([]);
    expect(paginationRange({ page: 1, count: Number.NaN })).toEqual([]);
    expect(paginationRange({ page: Number.NaN, count: 20 })).toEqual([1, 2, 3, 4, 5, 'end-ellipsis', 20]);
    expect(paginationRange({ page: 1, count: Infinity })).toEqual([]);
    expect(paginationRange({ page: 3, count: 10, siblings: Infinity })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginationRange({ page: 3, count: 10, boundaries: Infinity })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginationRange({ page: Infinity, count: 3 })).toEqual([1, 2, 3]);
  });

  it('holds its rules for every page, count, siblings and boundaries', () => {
    for (let siblings = 0; siblings <= 3; siblings++) {
      for (let boundaries = 0; boundaries <= 3; boundaries++) {
        const slots = 2 * boundaries + 2 * siblings + 3;
        for (let count = 1; count <= 30; count++) {
          for (let page = 1; page <= count; page++) {
            const items = paginationRange({ page, count, siblings, boundaries });
            const where = JSON.stringify({ page, count, siblings, boundaries, items });
            const pages = items.filter((item): item is number => typeof item === 'number');
            // One length while pages outnumber slots, so the controls never shift.
            expect(items.length, where).toBe(Math.min(count, slots));
            expect(pages, where).toEqual([...new Set(pages)].sort((a, b) => a - b));
            expect(pages, where).toContain(page);
            for (let p = Math.max(1, page - siblings); p <= Math.min(count, page + siblings); p++) {
              expect(pages, where).toContain(p);
            }
            for (let p = 1; p <= Math.min(boundaries, count); p++) {
              expect(pages, where).toContain(p);
              expect(pages, where).toContain(count - p + 1);
            }
            // Every gap stands for two or more pages.
            items.forEach((item: PaginationRangeItem, i) => {
              if (typeof item === 'number') return;
              const before = i > 0 ? (items[i - 1] as number) : 0;
              const after = i < items.length - 1 ? (items[i + 1] as number) : count + 1;
              expect(after - before - 1, where).toBeGreaterThanOrEqual(2);
            });
          }
        }
      }
    }
  });
});
