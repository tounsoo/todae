/// <reference lib="esnext.temporal" preserve="true" />

import { useEffect, useMemo, useRef, useState } from 'react';

/** How far from the anchor isDateDisabled has been checked, and the nearest days it ruled out. */
export type ReachScan = {
  anchor: Temporal.PlainDate;
  isDateDisabled: (date: Temporal.PlainDate) => boolean;
  min: Temporal.PlainDate | undefined;
  max: Temporal.PlainDate | undefined;
  /** The earliest and latest days checked. */
  below: Temporal.PlainDate;
  above: Temporal.PlainDate;
  /** The days beside the nearest ones ruled out, once found. */
  first: Temporal.PlainDate | null;
  last: Temporal.PlainDate | null;
};

/** The scan a calendar keeps between renders, such as in a ref. */
export type ReachCache = { current: ReachScan | null };

export type ReachLimits = {
  min: Temporal.PlainDate | undefined;
  max: Temporal.PlainDate | undefined;
  isDateDisabled: ((date: Temporal.PlainDate) => boolean) | undefined;
};

/**
 * The first and last days a range can reach, null where nothing stops it. Until
 * the scan is done, they stop at the days checked so far.
 */
export type Reach = { first: Temporal.PlainDate | null; last: Temporal.PlainDate | null; done: boolean };

const compare = (a: Temporal.PlainDate, b: Temporal.PlainDate) => Temporal.PlainDate.compare(a, b);

const sameDate = (a: Temporal.PlainDate | undefined, b: Temporal.PlainDate | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.equals(b));

/**
 * The first and last days a range from the anchor can reach: min and max, or
 * nearer, the days beside the nearest ones isDateDisabled rules out. Only the
 * shown month's days are drawn, so days are checked only as far as it reaches,
 * and each day once while the anchor, isDateDisabled, min and max stay the
 * same, which the cache remembers. A call checks at most `budget` days; the
 * next call with the same cache goes on from there.
 */
export function reachFrom(
  cache: ReachCache,
  anchor: Temporal.PlainDate,
  month: Temporal.PlainYearMonth,
  { min, max, isDateDisabled }: ReachLimits,
  budget: number,
): Reach {
  if (!isDateDisabled) return { first: min ?? null, last: max ?? null, done: true };
  let s = cache.current;
  if (
    !s ||
    !s.anchor.equals(anchor) ||
    s.isDateDisabled !== isDateDisabled ||
    !sameDate(s.min, min) ||
    !sameDate(s.max, max)
  ) {
    s = cache.current = { anchor, isDateDisabled, min, max, below: anchor, above: anchor, first: null, last: null };
  }
  const monthStart = month.toPlainDate({ day: 1 });
  const monthEnd = month.toPlainDate({ day: month.daysInMonth });
  const from = min && compare(min, monthStart) > 0 ? min : monthStart;
  const to = max && compare(max, monthEnd) < 0 ? max : monthEnd;
  let left = budget;
  while (!s.first && compare(s.below, from) > 0 && left-- > 0) {
    s.below = s.below.subtract({ days: 1 });
    if (isDateDisabled(s.below)) s.first = s.below.add({ days: 1 });
  }
  while (!s.last && compare(s.above, to) < 0 && left-- > 0) {
    s.above = s.above.add({ days: 1 });
    if (isDateDisabled(s.above)) s.last = s.above.subtract({ days: 1 });
  }
  const belowDone = Boolean(s.first) || compare(s.below, from) <= 0;
  const aboveDone = Boolean(s.last) || compare(s.above, to) >= 0;
  return {
    first: s.first ?? (belowDone ? (min ?? null) : s.below),
    last: s.last ?? (aboveDone ? (max ?? null) : s.above),
    done: belowDone && aboveDone,
  };
}

/** About two years of days: the most a render checks for a range's reach. */
export const SCAN_DAYS = 732;
/** Days checked between two looks at the clock while a frame goes on with a scan. */
export const SCAN_CHUNK_DAYS = 32;
/** How long a frame may go on checking after a render, in milliseconds. */
export const SCAN_SLICE_MS = 8;

/**
 * The reach of a range started on `anchor` over the shown month, null with no first
 * pick. A render checks at most SCAN_DAYS days. A far jump with an isDateDisabled that
 * rules out little would check millions in one render, so the rest of the scan runs in
 * slices between frames, and until it reaches a day, that day can't end the range. A
 * scan that hasn't finished starts over when the anchor, the month or a limit changes,
 * and stops on unmount.
 */
export function useReach(
  anchor: Temporal.PlainDate | null,
  month: Temporal.PlainYearMonth | null,
  { min, max, isDateDisabled }: ReachLimits,
): Reach | null {
  const cache = useRef<ReachScan | null>(null);
  const monthText = month?.toString() ?? null;
  const fresh = useMemo(
    () =>
      anchor && monthText !== null
        ? reachFrom(cache, anchor, Temporal.PlainYearMonth.from(monthText), { min, max, isDateDisabled }, SCAN_DAYS)
        : null,
    [anchor, isDateDisabled, max, min, monthText],
  );
  // What the frames found, for the render that `fresh` came from.
  const [carried, setCarried] = useState<{ from: Reach | null; reach: Reach } | null>(null);
  useEffect(() => {
    if (!anchor || monthText === null || !fresh || fresh.done) return;
    const target = Temporal.PlainYearMonth.from(monthText);
    let frame = requestAnimationFrame(function step() {
      const until = performance.now() + SCAN_SLICE_MS;
      let next: Reach;
      do next = reachFrom(cache, anchor, target, { min, max, isDateDisabled }, SCAN_CHUNK_DAYS);
      while (!next.done && performance.now() < until);
      if (next.done) setCarried({ from: fresh, reach: next });
      else frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, fresh, isDateDisabled, max, min, monthText]);
  return carried && carried.from === fresh ? carried.reach : fresh;
}
