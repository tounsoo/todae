/** One slot in a page range: a page number, or a gap standing for two or more pages. */
export type PaginationRangeItem = number | 'start-ellipsis' | 'end-ellipsis';

export type PaginationRangeOptions = {
  /** The current page, from 1. Clamped to 1..count. */
  page: number;
  /** How many pages there are. Below 1 gives an empty range. */
  count: number;
  /** Pages shown on each side of the current one. Default 1. */
  siblings?: number;
  /** Pages always shown at each end. Default 1. */
  boundaries?: number;
};

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

function whole(value: number, min: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min;
}

/**
 * The pages to show for `page` out of `count`: both ends, the current page with
 * its siblings, and an ellipsis for each gap. While there are more pages than
 * slots, the list always has the same length, so the controls do not shift as
 * the current page moves; an ellipsis never stands for a single page, which is
 * shown instead.
 */
export function paginationRange({ page, count, siblings = 1, boundaries = 1 }: PaginationRangeOptions): PaginationRangeItem[] {
  const total = whole(count, 0);
  if (total === 0) return [];
  const current = Math.min(whole(page, 1), total);
  const side = whole(siblings, 0);
  const ends = whole(boundaries, 0);
  // Both ends, the current page with its siblings, and one slot per gap.
  const slots = 2 * ends + 2 * side + 3;
  if (total <= slots) return range(1, total);

  // The window around the current page, slid inward near either end so the
  // number of slots stays the same.
  const start = Math.max(Math.min(current - side, total - ends - 2 * side - 1), ends + 2);
  const end = Math.min(Math.max(current + side, ends + 2 * side + 2), total - ends - 1);
  return [
    ...range(1, ends),
    start > ends + 2 ? 'start-ellipsis' : ends + 1,
    ...range(start, end),
    end < total - ends - 1 ? 'end-ellipsis' : total - ends,
    ...range(total - ends + 1, total),
  ];
}
