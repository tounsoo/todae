/// <reference lib="esnext.temporal" preserve="true" />

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

/** The first and last days a range can reach, null where nothing stops it. */
export type Reach = { first: Temporal.PlainDate | null; last: Temporal.PlainDate | null };

const compare = (a: Temporal.PlainDate, b: Temporal.PlainDate) => Temporal.PlainDate.compare(a, b);

const sameDate = (a: Temporal.PlainDate | undefined, b: Temporal.PlainDate | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.equals(b));

/**
 * The first and last days a range from the anchor can reach: min and max, or
 * nearer, the days beside the nearest ones isDateDisabled rules out. Only the
 * shown month's days are drawn, so days are checked only as far as it reaches,
 * and each day once while the anchor, isDateDisabled, min and max stay the
 * same, which the cache remembers.
 */
export function reachFrom(
  cache: ReachCache,
  anchor: Temporal.PlainDate,
  month: Temporal.PlainYearMonth,
  { min, max, isDateDisabled }: ReachLimits,
): Reach {
  if (!isDateDisabled) return { first: min ?? null, last: max ?? null };
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
  while (!s.first && compare(s.below, from) > 0) {
    s.below = s.below.subtract({ days: 1 });
    if (isDateDisabled(s.below)) s.first = s.below.add({ days: 1 });
  }
  while (!s.last && compare(s.above, to) < 0) {
    s.above = s.above.add({ days: 1 });
    if (isDateDisabled(s.above)) s.last = s.above.subtract({ days: 1 });
  }
  return { first: s.first ?? min ?? null, last: s.last ?? max ?? null };
}
