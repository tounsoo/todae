/// <reference lib="esnext.temporal" preserve="true" />

/**
 * Recurrence for the event calendar recipe. This is the recipe's data model,
 * not a design-system export. Views read occurrences. A series is what gets stored.
 *
 * The rule is a small RRULE subset on Temporal: FREQ, INTERVAL, COUNT, UNTIL,
 * and BYDAY for weekly. There is no runtime dependency beyond Temporal.
 *
 * A month that has no 31st does not clamp. A monthly series that starts on the
 * 31st skips that month, which is what RFC 5545 does for BYMONTHDAY. A yearly
 * series that starts on 29 February skips years that are not leap years.
 *
 * Wall-clock time is kept in the series' time zone. A 9:00 meeting stays 9:00
 * local across a daylight-saving change. A wall time that does not exist on
 * that day (the skipped hour) uses Temporal's `compatible` disambiguation.
 *
 * Expansion returns occurrences whose start falls in `[window.start, window.end)`.
 * It stops after {@link EXPANSION_CAP} occurrences in that window, so a daily
 * series with no end still finishes. A year of daily occurrences fits under the cap.
 */

const seriesBrand: unique symbol = Symbol('SeriesId');
const occurrenceBrand: unique symbol = Symbol('OccurrenceId');

/** The stored series. Not interchangeable with an occurrence id. */
export type SeriesId = string & { readonly [seriesBrand]: true };

/** One generated instance. Stable for a series and its original start. */
export type OccurrenceId = string & { readonly [occurrenceBrand]: true };

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** RFC 5545 weekday tokens. Monday is the week start used to count INTERVAL. */
export type ByDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export type RecurrenceEnd =
  | { kind: 'never' }
  | { kind: 'count'; count: number }
  | { kind: 'until'; until: Temporal.ZonedDateTime };

export type RecurrenceRule = {
  freq: Frequency;
  /** At least 1. Weekly INTERVAL counts weeks from the Monday of the first start. */
  interval: number;
  /** Weekly only. Omitted means the weekday of the series start. */
  byDay?: readonly ByDay[];
  end: RecurrenceEnd;
};

/** A replacement for one generated start. Keyed by that original start. */
export type OccurrenceOverride = {
  originalStart: Temporal.ZonedDateTime;
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
};

export type EventSeries = {
  id: SeriesId;
  title: string;
  timeZone: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
  /** Null is a single event. Anything else repeats. */
  rule: RecurrenceRule | null;
  /** Original starts removed from the set. They still consume COUNT. */
  exdates: readonly Temporal.ZonedDateTime[];
  overrides: readonly OccurrenceOverride[];
};

export type Occurrence = {
  id: OccurrenceId;
  seriesId: SeriesId;
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
  repeats: boolean;
  /** The start the rule generated, before an override moved it. */
  originalStart: Temporal.ZonedDateTime;
};

export type ExpandWindow = {
  /** Inclusive. */
  start: Temporal.ZonedDateTime;
  /** Exclusive. */
  end: Temporal.ZonedDateTime;
};

/**
 * Most occurrences one expansion returns. A daily series across a year (366
 * occurrences) stays under this. A longer window keeps the earliest ones and stops.
 */
export const EXPANSION_CAP = 400;

const WEEKDAY_INDEX: Record<ByDay, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
const INDEX_WEEKDAY: readonly ByDay[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function seriesId(value: string): SeriesId {
  return value as SeriesId;
}

export function occurrenceId(series: SeriesId, originalStart: Temporal.ZonedDateTime, repeats: boolean): OccurrenceId {
  const text = repeats ? `${series}/${originalStart.epochNanoseconds.toString()}` : series;
  return text as OccurrenceId;
}

export function repeats(series: EventSeries): boolean {
  return series.rule !== null;
}

function assertRule(rule: RecurrenceRule): void {
  if (!Number.isInteger(rule.interval) || rule.interval < 1) throw new RangeError('interval must be an integer of at least 1');
  if (rule.end.kind === 'count' && (!Number.isInteger(rule.end.count) || rule.end.count < 1)) {
    throw new RangeError('count must be an integer of at least 1');
  }
}

function sameInstant(a: Temporal.ZonedDateTime, b: Temporal.ZonedDateTime): boolean {
  return a.epochNanoseconds === b.epochNanoseconds;
}

function wall(value: Temporal.ZonedDateTime, timeZone: string): Temporal.PlainDateTime {
  return value.withTimeZone(timeZone).toPlainDateTime();
}

function atWall(date: Temporal.PlainDate, time: Temporal.PlainTime, timeZone: string): Temporal.ZonedDateTime {
  return date.toZonedDateTime({ timeZone, plainTime: time });
}

function endAt(start: Temporal.ZonedDateTime, duration: Temporal.Duration, timeZone: string): Temporal.ZonedDateTime {
  return wall(start, timeZone).add(duration).toZonedDateTime(timeZone);
}

function mondayOf(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

export function byDayOf(date: Temporal.PlainDate): ByDay {
  return INDEX_WEEKDAY[date.dayOfWeek - 1] ?? 'MO';
}

function weekdays(rule: RecurrenceRule, start: Temporal.PlainDate): ByDay[] {
  const listed = rule.freq === 'WEEKLY' ? (rule.byDay ?? []) : [];
  const days = listed.length > 0 ? listed : [byDayOf(start)];
  return [...new Set(days)].sort((a, b) => WEEKDAY_INDEX[a] - WEEKDAY_INDEX[b]);
}

function inWindow(start: Temporal.ZonedDateTime, window: ExpandWindow): boolean {
  return Temporal.ZonedDateTime.compare(start, window.start) >= 0 && Temporal.ZonedDateTime.compare(start, window.end) < 0;
}

function exdated(series: EventSeries, original: Temporal.ZonedDateTime): boolean {
  return series.exdates.some((date) => sameInstant(date, original));
}

function overrideFor(series: EventSeries, original: Temporal.ZonedDateTime): OccurrenceOverride | null {
  return series.overrides.find((item) => sameInstant(item.originalStart, original)) ?? null;
}

function dailyStep(start: Temporal.PlainDate, date: Temporal.PlainDate, interval: number): number | null {
  const days = start.until(date, { largestUnit: 'day' }).days;
  if (days < 0 || days % interval !== 0) return null;
  return days / interval;
}

function monthlyDate(start: Temporal.PlainDate, step: number, interval: number): Temporal.PlainDate | null {
  const month = Temporal.PlainYearMonth.from(start).add({ months: step * interval });
  if (start.day > month.daysInMonth) return null;
  return month.toPlainDate({ day: start.day });
}

function yearlyDate(start: Temporal.PlainDate, step: number, interval: number): Temporal.PlainDate | null {
  const month = Temporal.PlainYearMonth.from({ year: start.year + step * interval, month: start.month });
  if (start.day > month.daysInMonth) return null;
  return month.toPlainDate({ day: start.day });
}

function weeklyDates(start: Temporal.PlainDate, weekIndex: number, interval: number, days: readonly ByDay[]): Temporal.PlainDate[] {
  const monday = mondayOf(start).add({ weeks: weekIndex * interval });
  const dates: Temporal.PlainDate[] = [];
  for (const day of days) {
    const date = monday.add({ days: WEEKDAY_INDEX[day] });
    if (Temporal.PlainDate.compare(date, start) >= 0) dates.push(date);
  }
  return dates;
}

/** Valid weekly occurrences strictly before `weekIndex`. Later weeks include every chosen day. */
function weeklyBefore(start: Temporal.PlainDate, weekIndex: number, interval: number, days: readonly ByDay[]): number {
  if (weekIndex <= 0) return 0;
  const first = weeklyDates(start, 0, interval, days).length;
  return first + (weekIndex - 1) * days.length;
}

function monthStep(start: Temporal.PlainDate, date: Temporal.PlainDate, interval: number): number {
  const months = Temporal.PlainYearMonth.from(start).until(Temporal.PlainYearMonth.from(date), { largestUnit: 'month' }).months;
  if (months <= 0) return 0;
  return Math.floor(months / interval);
}

function yearStep(start: Temporal.PlainDate, date: Temporal.PlainDate, interval: number): number {
  const years = date.year - start.year;
  if (years <= 0) return 0;
  return Math.floor(years / interval);
}

function weekStep(start: Temporal.PlainDate, date: Temporal.PlainDate, interval: number): number {
  const weeks = mondayOf(start).until(mondayOf(date), { largestUnit: 'week' }).weeks;
  if (weeks <= 0) return 0;
  return Math.floor(weeks / interval);
}

/**
 * The 0-based index of `instant` in the rule, or null when it is not a generated start.
 * COUNT and UNTIL are applied by the caller. This walks the grid with date arithmetic,
 * not by listing every occurrence from the series start.
 */
export function occurrenceIndex(series: EventSeries, instant: Temporal.ZonedDateTime): number | null {
  const rule = series.rule;
  const startWall = wall(series.start, series.timeZone);
  const at = wall(instant, series.timeZone);
  if (!at.toPlainTime().equals(startWall.toPlainTime())) return null;
  if (rule === null) {
    return at.toPlainDate().equals(startWall.toPlainDate()) ? 0 : null;
  }
  assertRule(rule);
  const startDate = startWall.toPlainDate();
  const date = at.toPlainDate();
  if (Temporal.PlainDate.compare(date, startDate) < 0) return null;
  if (rule.freq === 'DAILY') return dailyStep(startDate, date, rule.interval);
  if (rule.freq === 'WEEKLY') {
    const days = weekdays(rule, startDate);
    const step = weekStep(startDate, date, rule.interval);
    const dates = weeklyDates(startDate, step, rule.interval, days);
    const place = dates.findIndex((item) => item.equals(date));
    if (place < 0) return null;
    return weeklyBefore(startDate, step, rule.interval, days) + place;
  }
  if (rule.freq === 'MONTHLY') {
    const step = monthStep(startDate, date, rule.interval);
    const found = monthlyDate(startDate, step, rule.interval);
    if (!found || !found.equals(date)) return null;
    return countValid(startDate, step, (index) => monthlyDate(startDate, index, rule.interval));
  }
  const step = yearStep(startDate, date, rule.interval);
  const found = yearlyDate(startDate, step, rule.interval);
  if (!found || !found.equals(date)) return null;
  return countValid(startDate, step, (index) => yearlyDate(startDate, index, rule.interval));
}

function countValid(start: Temporal.PlainDate, step: number, dateAt: (index: number) => Temporal.PlainDate | null): number {
  // Day 28 and earlier exists in every month, so the index is the step.
  if (start.day <= 28) return step;
  let valid = 0;
  for (let index = 0; index < step; index += 1) if (dateAt(index)) valid += 1;
  return valid;
}

function withinLimits(rule: RecurrenceRule, index: number, original: Temporal.ZonedDateTime): boolean {
  if (rule.end.kind === 'count' && index >= rule.end.count) return false;
  if (rule.end.kind === 'until' && Temporal.ZonedDateTime.compare(original, rule.end.until) > 0) return false;
  return true;
}

function toOccurrence(series: EventSeries, original: Temporal.ZonedDateTime, duration: Temporal.Duration): Occurrence {
  const replacement = overrideFor(series, original);
  const start = replacement?.start ?? original;
  const repeatsSeries = repeats(series);
  // The template's end is an exact instant. Rebuilding it from the wall duration
  // would pick the earlier offset of a repeated hour and finish before it started.
  const templateEnd = sameInstant(original, series.start) ? series.end : endAt(original, duration, series.timeZone);
  return {
    id: occurrenceId(series.id, original, repeatsSeries),
    seriesId: series.id,
    title: replacement?.title ?? series.title,
    start,
    end: replacement?.end ?? templateEnd,
    allDay: replacement?.allDay ?? series.allDay,
    repeats: repeatsSeries,
    originalStart: original,
  };
}

type Step = { dates: Temporal.PlainDate[]; before: number };

function stepAt(rule: RecurrenceRule, start: Temporal.PlainDate, index: number): Step {
  if (rule.freq === 'DAILY') {
    return { dates: [start.add({ days: index * rule.interval })], before: index };
  }
  if (rule.freq === 'WEEKLY') {
    const days = weekdays(rule, start);
    return { dates: weeklyDates(start, index, rule.interval, days), before: weeklyBefore(start, index, rule.interval, days) };
  }
  if (rule.freq === 'MONTHLY') {
    const date = monthlyDate(start, index, rule.interval);
    return { dates: date ? [date] : [], before: countValid(start, index, (step) => monthlyDate(start, step, rule.interval)) };
  }
  const date = yearlyDate(start, index, rule.interval);
  return { dates: date ? [date] : [], before: countValid(start, index, (step) => yearlyDate(start, step, rule.interval)) };
}

function firstStep(rule: RecurrenceRule, start: Temporal.PlainDate, windowStart: Temporal.ZonedDateTime, timeZone: string): number {
  const date = windowStart.withTimeZone(timeZone).toPlainDate();
  if (rule.freq === 'DAILY') {
    const days = start.until(date, { largestUnit: 'day' }).days;
    if (days <= 0) return 0;
    return Math.floor(days / rule.interval);
  }
  if (rule.freq === 'WEEKLY') return weekStep(start, date, rule.interval);
  if (rule.freq === 'MONTHLY') return monthStep(start, date, rule.interval);
  return yearStep(start, date, rule.interval);
}

/**
 * Occurrences of `series` whose start is inside `[window.start, window.end)`.
 * An override is included when the moved start falls in the window, and left out
 * when the move takes it outside, still keyed by the original start.
 */
export function expandSeries(series: EventSeries, window: ExpandWindow): Occurrence[] {
  if (Temporal.ZonedDateTime.compare(window.end, window.start) <= 0) return [];
  if (series.rule) assertRule(series.rule);
  const duration = wall(series.start, series.timeZone).until(wall(series.end, series.timeZone));
  const found = new Map<string, Occurrence>();
  const keep = (occurrence: Occurrence) => {
    if (!inWindow(occurrence.start, window)) return;
    found.set(occurrence.id, occurrence);
  };

  if (series.rule === null) {
    if (!exdated(series, series.start)) keep(toOccurrence(series, series.start, duration));
  } else {
    const startDate = wall(series.start, series.timeZone).toPlainDate();
    const time = wall(series.start, series.timeZone).toPlainTime();
    let step = firstStep(series.rule, startDate, window.start, series.timeZone);
    let seen = stepAt(series.rule, startDate, step).before;
    const limit = series.rule.end.kind === 'count' ? series.rule.end.count : Number.POSITIVE_INFINITY;
    // Skipped months (the 31st) and skipped leap days advance a step without a date.
    // The cap is a backstop so a bug in that walk cannot spin.
    let spins = 0;
    while (found.size < EXPANSION_CAP && seen < limit && spins < EXPANSION_CAP + 4000) {
      spins += 1;
      const current = stepAt(series.rule, startDate, step);
      step += 1;
      if (current.dates.length === 0) continue;
      let passed = false;
      for (const date of current.dates) {
        if (seen >= limit) break;
        const original = atWall(date, time, series.timeZone);
        if (series.rule.end.kind === 'until' && Temporal.ZonedDateTime.compare(original, series.rule.end.until) > 0) {
          passed = true;
          break;
        }
        seen += 1;
        if (Temporal.ZonedDateTime.compare(original, window.end) >= 0) {
          passed = true;
          break;
        }
        if (exdated(series, original)) continue;
        keep(toOccurrence(series, original, duration));
        if (found.size >= EXPANSION_CAP) break;
      }
      if (passed) break;
    }
  }

  for (const replacement of series.overrides) {
    if (exdated(series, replacement.originalStart)) continue;
    const index = occurrenceIndex(series, replacement.originalStart);
    if (index === null) continue;
    if (series.rule && !withinLimits(series.rule, index, replacement.originalStart)) continue;
    keep(toOccurrence(series, replacement.originalStart, duration));
  }

  return [...found.values()]
    .sort((a, b) => Temporal.ZonedDateTime.compare(a.start, b.start) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, EXPANSION_CAP);
}

/**
 * The window views should ask for. Pulls the start back by this series' length
 * so an occurrence that began before the visible range and still overlaps it is included.
 */
export function viewWindow(series: EventSeries, visible: ExpandWindow): ExpandWindow {
  const duration = wall(series.start, series.timeZone).until(wall(series.end, series.timeZone));
  return { start: visible.start.subtract(duration), end: visible.end };
}

export type SeriesDraft = {
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
  rule: RecurrenceRule | null;
};

function shiftInstant(value: Temporal.ZonedDateTime, delta: Temporal.Duration): Temporal.ZonedDateTime {
  return value.add(delta);
}

/** All events. The template changes, and exceptions stay attached to the same ordinal start. */
export function replaceSeries(series: EventSeries, next: SeriesDraft): EventSeries {
  const delta = series.start.until(next.start);
  return {
    ...series,
    title: next.title,
    timeZone: next.start.timeZoneId,
    start: next.start,
    end: next.end,
    allDay: next.allDay,
    rule: next.rule,
    exdates: series.exdates.map((date) => shiftInstant(date, delta)),
    overrides: series.overrides.map((item) => ({
      ...item,
      originalStart: shiftInstant(item.originalStart, delta),
      start: shiftInstant(item.start, delta),
      end: shiftInstant(item.end, delta),
    })),
  };
}

/** This event. The override replaces the generated occurrence and keeps its original start. */
export function overrideOccurrence(series: EventSeries, originalStart: Temporal.ZonedDateTime, next: Omit<SeriesDraft, 'rule'>): EventSeries {
  const overrides = series.overrides.filter((item) => !sameInstant(item.originalStart, originalStart));
  overrides.push({ originalStart, title: next.title, start: next.start, end: next.end, allDay: next.allDay });
  return { ...series, overrides };
}

/** This event, removed. The original start is an EXDATE and no longer an override. */
export function excludeOccurrence(series: EventSeries, originalStart: Temporal.ZonedDateTime): EventSeries {
  if (series.exdates.some((date) => sameInstant(date, originalStart))) {
    return { ...series, overrides: series.overrides.filter((item) => !sameInstant(item.originalStart, originalStart)) };
  }
  return {
    ...series,
    exdates: [...series.exdates, originalStart],
    overrides: series.overrides.filter((item) => !sameInstant(item.originalStart, originalStart)),
  };
}

/**
 * The series that remains before `originalStart`. Null when that was the first
 * occurrence. UNTIL is exclusive of this start, so this and every later one drop off.
 */
export function truncateBefore(series: EventSeries, originalStart: Temporal.ZonedDateTime): EventSeries | null {
  if (series.rule === null) return null;
  const until = originalStart.subtract({ nanoseconds: 1 });
  if (Temporal.ZonedDateTime.compare(until, series.start) < 0) return null;
  const earlierUntil = series.rule.end.kind === 'until' && Temporal.ZonedDateTime.compare(series.rule.end.until, until) < 0 ? series.rule.end.until : until;
  return {
    ...series,
    rule: { ...series.rule, end: { kind: 'until', until: earlierUntil } },
    exdates: series.exdates.filter((date) => Temporal.ZonedDateTime.compare(date, originalStart) < 0),
    overrides: series.overrides.filter((item) => Temporal.ZonedDateTime.compare(item.originalStart, originalStart) < 0),
  };
}

export function seriesFromDraft(id: SeriesId, draft: SeriesDraft): EventSeries {
  return {
    id,
    title: draft.title,
    timeZone: draft.start.timeZoneId,
    start: draft.start,
    end: draft.end,
    allDay: draft.allDay,
    rule: draft.rule,
    exdates: [],
    overrides: [],
  };
}
