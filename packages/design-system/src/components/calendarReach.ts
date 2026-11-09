/// <reference lib="esnext.temporal" preserve="true" />

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** How far from the anchor isDateDisabled has been checked, and the nearest days it ruled out. */
type ReachScan = {
  anchor: Temporal.PlainDate;
  rescan: number;
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
type ReachCache = { current: ReachScan | null };

type ReachLimits = {
  min: Temporal.PlainDate | undefined;
  max: Temporal.PlainDate | undefined;
  isDateDisabled: ((date: Temporal.PlainDate) => boolean) | undefined;
};

/**
 * The first and last days a range can reach, null where nothing stops it. Until
 * the scan is done, they stop at the days checked so far.
 */
type Reach = { first: Temporal.PlainDate | null; last: Temporal.PlainDate | null; done: boolean };

const compare = (a: Temporal.PlainDate, b: Temporal.PlainDate) => Temporal.PlainDate.compare(a, b);

const sameDate = (a: Temporal.PlainDate | undefined, b: Temporal.PlainDate | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.equals(b));

/**
 * The first and last days a range from the anchor can reach: min and max, or
 * nearer, the days beside the nearest ones isDateDisabled rules out. Only the
 * shown month's days are drawn, so days are checked only as far as it reaches,
 * and each day once while the anchor, min, max and `rescan` stay the same,
 * which the cache remembers. A new isDateDisabled goes on from the days checked
 * so far, so an inline function doesn't start the scan over on every render. A
 * call checks at most `budget` days; the next call with the same cache goes on
 * from there.
 */
function reachFrom(
  cache: ReachCache,
  anchor: Temporal.PlainDate,
  month: Temporal.PlainYearMonth,
  { min, max, isDateDisabled }: ReachLimits,
  rescan: number,
  budget: number,
): Reach {
  if (!isDateDisabled) return { first: min ?? null, last: max ?? null, done: true };
  let s = cache.current;
  if (!s || !s.anchor.equals(anchor) || s.rescan !== rescan || !sameDate(s.min, min) || !sameDate(s.max, max)) {
    s = cache.current = { anchor, rescan, min, max, below: anchor, above: anchor, first: null, last: null };
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
const SCAN_DAYS = 732;
/** Days checked between two looks at the clock while a frame goes on with a scan. */
const SCAN_CHUNK_DAYS = 32;
/** How long a frame may go on checking after a render, in milliseconds. */
const SCAN_SLICE_MS = 8;

/**
 * The reach of a range started on `anchor` over the shown month, null with no first
 * pick. A render checks at most SCAN_DAYS days. A far jump with an isDateDisabled that
 * rules out little would check millions in one render, so the rest of the scan runs in
 * slices between frames, and until it reaches a day, that day can't end the range. A
 * scan starts over when the anchor, min, max or `rescan` changes, goes on toward the
 * new month when the month changes, and stops on unmount. A new isDateDisabled checks
 * the days from where the scan is, so a parent that renders on every frame with an
 * inline function still lets the scan finish; a change to `rescan` checks every day
 * again with the newest one.
 */
export function useReach(
  anchor: Temporal.PlainDate | null,
  month: Temporal.PlainYearMonth | null,
  { min, max, isDateDisabled }: ReachLimits,
  rescan: number,
): Reach | null {
  const cache = useRef<ReachScan | null>(null);
  // The newest isDateDisabled, for the frames after the render that gave it.
  const latest = useRef(isDateDisabled);
  useLayoutEffect(() => {
    latest.current = isDateDisabled;
  });
  const monthText = month?.toString() ?? null;
  const limited = isDateDisabled !== undefined;
  const fresh = useMemo(
    () =>
      anchor && monthText !== null
        ? reachFrom(
            cache,
            anchor,
            Temporal.PlainYearMonth.from(monthText),
            { min, max, isDateDisabled },
            rescan,
            SCAN_DAYS,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- not isDateDisabled itself: an inline one is new each render, and the cache goes on with this render's
    [anchor, limited, max, min, monthText, rescan],
  );
  // What the frames found, for the render that `fresh` came from.
  const [carried, setCarried] = useState<{ from: Reach | null; reach: Reach } | null>(null);
  useEffect(() => {
    if (!anchor || monthText === null || !fresh || fresh.done) return;
    const target = Temporal.PlainYearMonth.from(monthText);
    let frame = requestAnimationFrame(function step() {
      const until = performance.now() + SCAN_SLICE_MS;
      let next: Reach;
      do next = reachFrom(cache, anchor, target, { min, max, isDateDisabled: latest.current }, rescan, SCAN_CHUNK_DAYS);
      while (!next.done && performance.now() < until);
      if (next.done) setCarried({ from: fresh, reach: next });
      else frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, fresh, max, min, monthText, rescan]);
  return carried && carried.from === fresh ? carried.reach : fresh;
}
