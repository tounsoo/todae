/// <reference lib="esnext.temporal" preserve="true" />

/**
 * A span of days, start and end included. Given in either order, it is read
 * with the earlier date as its start.
 */
export type DateRange = { start: Temporal.PlainDate; end: Temporal.PlainDate };

/** The range from a to b, the earlier date as its start. */
export const spanOf = (a: Temporal.PlainDate, b: Temporal.PlainDate): DateRange =>
  Temporal.PlainDate.compare(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
