'use client';

import {
  Button,
  Calendar,
  Dialog,
  ErrorMessage,
  Field,
  Form,
  Label,
  Menu,
  RadioGroup,
  ScrollArea,
  Switch,
  Text,
  ToggleGroup,
  VisuallyHidden,
  formatTime,
  useAnnouncer,
  useFocusHandoff,
  useLaneDrag,
  useLaneDragState,
  type FormErrors,
  type UseLaneDragResult,
} from '@tounsoo/todae';
import { memo, useId, useLayoutEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import {
  byDayOf,
  excludeOccurrence,
  expandSeries,
  overrideOccurrence,
  replaceSeries,
  seriesFromDraft,
  seriesId,
  truncateBefore,
  viewWindow,
  type ByDay,
  type EventSeries,
  type ExpandWindow,
  type RecurrenceRule,
  type SeriesId,
} from './recurrence';
import styles from './EventCalendar.module.css';

export type CalendarEvent = {
  id: string;
  title: string;
  seriesId?: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
  /** True when the event is one occurrence of a repeating series. */
  repeats?: boolean;
  /** The start the rule generated, before an override moved it. */
  originalStart?: Temporal.ZonedDateTime;
};

export type EditScope = 'occurrence' | 'following' | 'series';

export type DaySegment = {
  day: Temporal.PlainDate;
  opens: Temporal.ZonedDateTime;
  closes: Temporal.ZonedDateTime;
  length: number;
};

export type DayAxis = { segments: readonly DaySegment[] };

export type DayPosition = { day: Temporal.PlainDate; units: number };

type Edge = 'start' | 'end';

function zoned(day: Temporal.PlainDate, time: Temporal.PlainTime, timeZone: string): Temporal.ZonedDateTime {
  return day.toZonedDateTime({ timeZone, plainTime: time });
}

function minutesBetween(from: Temporal.ZonedDateTime, to: Temporal.ZonedDateTime): number {
  return (to.epochMilliseconds - from.epochMilliseconds) / 60_000;
}

/**
 * PlainTime has no 24:00, so a close at or before the open on the clock is that
 * time the next day. When the resolved close still falls at or before the open,
 * the whole range sat in a skipped hour and the lane is empty.
 */
export function daySegments({
  days,
  opens,
  closes,
  timeZone,
}: {
  days: readonly Temporal.PlainDate[];
  opens: Temporal.PlainTime;
  closes: Temporal.PlainTime;
  timeZone: string;
}): DayAxis {
  const wraps = Temporal.PlainTime.compare(closes, opens) <= 0;
  return {
    segments: days.map((day) => {
      const open = zoned(day, opens, timeZone);
      let close = zoned(wraps ? day.add({ days: 1 }) : day, closes, timeZone);
      if (Temporal.ZonedDateTime.compare(close, open) <= 0) close = open;
      return { day, opens: open, closes: close, length: minutesBetween(open, close) };
    }),
  };
}

// The close of one day and the open of the next can be one instant. A start
// belongs to the later day, and an end to the earlier one.
function holds(length: number, units: number, edge: Edge): boolean {
  return edge === 'start' ? units >= 0 && units < length : units > 0 && units <= length;
}

export function toUnits(axis: DayAxis, at: Temporal.ZonedDateTime, edge: Edge = 'start'): DayPosition | null {
  for (const segment of axis.segments) {
    const units = minutesBetween(segment.opens, at);
    if (holds(segment.length, units, edge)) return { day: segment.day, units };
  }
  return null;
}

export function fromUnits(segment: DaySegment, units: number, edge: Edge = 'start'): Temporal.ZonedDateTime | null {
  if (!holds(segment.length, units, edge)) return null;
  return segment.opens.add({ minutes: units });
}

export function snapGrid(segment: DaySegment, step: number): number[] {
  if (step <= 0) throw new RangeError('step must be greater than 0');
  const points = new Set<number>();
  for (let units = 0; units < segment.length; units += step) points.add(units);
  points.add(segment.length);
  return [...points].sort((a, b) => a - b);
}

/** The slot a timed event moves or resizes by. Week and day lanes snap to it. */
export const SLOT_MINUTES = 15;

export type LaneSpan = { start: number; end: number };

export type SlotEdge = 'move' | 'start' | 'end';

const GRID_DAY = Temporal.PlainDate.from('1970-01-01');
const GRID_OPEN = GRID_DAY.toZonedDateTime('UTC');

function gridFor(length: number, step: number): number[] {
  return snapGrid({ day: GRID_DAY, opens: GRID_OPEN, closes: GRID_OPEN, length }, step);
}

/**
 * The grid point nearest `units`. A tie goes to the earlier point, the same
 * choice `useLaneDrag` makes. `length` is on the grid, so a close can be hit.
 */
export function snapToSlot(units: number, step: number, length: number): number {
  const grid = gridFor(length, step);
  let best = grid[0] ?? 0;
  let bestDistance = Math.abs(units - best);
  for (const point of grid) {
    const distance = Math.abs(units - point);
    if (distance < bestDistance || (distance === bestDistance && point < best)) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

function fittingStart(span: number, proposed: number, length: number, step: number): number | null {
  if (span <= 0 || span > length) return null;
  let start = snapToSlot(proposed, step, length);
  if (start < 0) start = 0;
  if (start + span <= length) return start;
  const room = length - span;
  start = snapToSlot(room, step, length);
  if (start + span <= length && start >= 0) return start;
  const grid = gridFor(length, step);
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    const point = grid[index] ?? 0;
    if (point >= 0 && point + span <= length) return point;
  }
  return null;
}

/**
 * Where a move or a resize lands on a lane of `length` minutes.
 * A move keeps its length, snaps the start, and slides back inside the lane.
 * A resize snaps the moved edge, keeps the other, and stops one `step` short
 * of it. Null when the span cannot sit in the lane.
 */
export function clampSpan(
  current: LaneSpan,
  proposed: LaneSpan,
  length: number,
  step: number,
  edge: SlotEdge,
): LaneSpan | null {
  if (length <= 0 || step <= 0) return null;
  if (edge === 'move') {
    const span = current.end - current.start;
    const start = fittingStart(span, proposed.start, length, step);
    if (start === null) return null;
    return { start, end: start + span };
  }
  if (edge === 'end') {
    let end = snapToSlot(proposed.end, step, length);
    if (end > length) end = snapToSlot(length, step, length);
    const minEnd = current.start + step;
    if (end < minEnd) end = minEnd;
    if (end > length || end <= current.start) return null;
    return { start: current.start, end };
  }
  let start = snapToSlot(proposed.start, step, length);
  if (start < 0) start = 0;
  const maxStart = current.end - step;
  if (start > maxStart) start = maxStart;
  if (start < 0 || start >= current.end) return null;
  return { start, end: current.end };
}

/** A drop keeps `next`. Escape, or a drop with nowhere to land, keeps `original`. */
export function finishGesture<T>(original: T, next: T | null, gesture: 'drop' | 'escape'): T {
  if (gesture === 'escape' || next === null) return original;
  return next;
}

export type SlotChange = { kind: 'shift'; slots: number } | { kind: 'day'; days: number } | { kind: 'length'; slots: number };

function shiftEvent(event: CalendarEvent, minutes: number, days: number, timeZone: string): CalendarEvent {
  // Add the day in the calendar's zone, then the minutes. One duration whose
  // day and minute signs differ is rejected, and the event's own zone would
  // keep its wall clock across a clock change.
  const shift = (value: Temporal.ZonedDateTime) => value.withTimeZone(timeZone).add({ days }).add({ minutes });
  return { ...event, start: shift(event.start), end: shift(event.end) };
}

function clippedUnits(segment: DaySegment, event: CalendarEvent): LaneSpan | null {
  if (event.allDay || segment.length === 0) return null;
  if (Temporal.ZonedDateTime.compare(event.start, segment.closes) >= 0) return null;
  if (Temporal.ZonedDateTime.compare(event.end, segment.opens) <= 0) return null;
  const clippedStart = Temporal.ZonedDateTime.compare(event.start, segment.opens) < 0 ? segment.opens : event.start;
  const clippedEnd = Temporal.ZonedDateTime.compare(event.end, segment.closes) > 0 ? segment.closes : event.end;
  const start = (clippedStart.epochMilliseconds - segment.opens.epochMilliseconds) / 60_000;
  const end = (clippedEnd.epochMilliseconds - segment.opens.epochMilliseconds) / 60_000;
  if (end <= start) return null;
  return { start, end };
}

/**
 * One keyboard step on `segment`. A shift or a day move that would leave the
 * lane does nothing, so the menu can disable it. Lengthening and shortening
 * move the end, and stop at the close and at one slot long.
 */
export function adjustEvent(event: CalendarEvent, segment: DaySegment, axis: DayAxis, change: SlotChange, step = SLOT_MINUTES): CalendarEvent | null {
  const visible = clippedUnits(segment, event);
  if (!visible) return null;
  if (change.kind === 'shift') {
    const proposed = { start: visible.start + change.slots * step, end: visible.end + change.slots * step };
    if (proposed.start < 0 || proposed.end > segment.length) return null;
    return shiftEvent(event, change.slots * step, 0, segment.opens.timeZoneId);
  }
  if (change.kind === 'day') {
    const targetDay = segment.day.add({ days: change.days });
    const target = axis.segments.find((each) => each.day.equals(targetDay));
    if (!target || visible.end > target.length) return null;
    return shiftEvent(event, 0, change.days, segment.opens.timeZoneId);
  }
  const proposedEnd = visible.end + change.slots * step;
  if (proposedEnd > segment.length || proposedEnd - visible.start < step) return null;
  const clamped = clampSpan(visible, { start: visible.start, end: proposedEnd }, segment.length, step, 'end');
  if (!clamped || clamped.end !== proposedEnd) return null;
  const end = fromUnits(segment, clamped.end, 'end');
  if (!end || Temporal.ZonedDateTime.compare(end, event.start) <= 0) return null;
  return { ...event, end };
}

export type LaneDrop = {
  from: { day: Temporal.PlainDate; start: number; end: number };
  to: { day: Temporal.PlainDate; start: number; end: number };
  kind: 'move' | 'resize-start' | 'resize-end';
};

/**
 * The event a drop leaves. A move keeps the length and shifts the whole event,
 * including the part a lane clips, by the snapped delta. A resize writes the
 * drawn edge, so a handle on a clipped side sets the real start or end.
 */
export function eventFromLane(event: CalendarEvent, drop: LaneDrop, axis: DayAxis): CalendarEvent | null {
  const segment = axis.segments.find((each) => each.day.equals(drop.to.day));
  if (!segment) return null;
  const zone = segment.opens.timeZoneId;
  // `to` is the place useLaneDrag already snapped. Snapping it again would hide a grid change.
  if (drop.kind === 'move') {
    const days = drop.from.day.until(drop.to.day, { largestUnit: 'day' }).days;
    return shiftEvent(event, drop.to.start - drop.from.start, days, zone);
  }
  if (drop.kind === 'resize-end') {
    const end = fromUnits(segment, drop.to.end, 'end');
    if (!end || Temporal.ZonedDateTime.compare(end, event.start) <= 0) return null;
    return { ...event, end };
  }
  const start = fromUnits(segment, drop.to.start, 'start');
  if (!start || Temporal.ZonedDateTime.compare(event.end, start) <= 0) return null;
  return { ...event, start };
}

export type EventDraft = {
  title: string;
  date: Temporal.PlainDate | null;
  endDate: Temporal.PlainDate | null;
  start: Temporal.PlainTime | null;
  end: Temporal.PlainTime | null;
  allDay: boolean;
};

export type DraftIssue = { field: 'title' | 'date' | 'start' | 'end' | 'endDate'; message: string };

/** Keeps the draft's length when the date or the start moves, and leaves every other field as it was set. */
export function shiftDraft<K extends keyof EventDraft>(draft: EventDraft, key: K, value: EventDraft[K], timeZone: string): EventDraft {
  if (key === 'date' && value instanceof Temporal.PlainDate && draft.date && draft.endDate) {
    const days = draft.date.until(value, { largestUnit: 'day' }).days;
    return { ...draft, date: value, endDate: draft.endDate.add({ days }) };
  }
  if (key === 'start' && value instanceof Temporal.PlainTime && draft.start && draft.end && draft.date && draft.endDate) {
    const from = draft.date.toZonedDateTime({ timeZone, plainTime: draft.start });
    const to = draft.endDate.toZonedDateTime({ timeZone, plainTime: draft.end });
    const next = to.add(from.until(draft.date.toZonedDateTime({ timeZone, plainTime: value })));
    return { ...draft, start: value, endDate: next.withTimeZone(timeZone).toPlainDate(), end: next.withTimeZone(timeZone).toPlainTime() };
  }
  return { ...draft, [key]: value };
}

/** The event a dialog's fields name, or the first field that is wrong. */
export function eventFromDraft(draft: EventDraft, timeZone: string): { ok: true; value: Pick<CalendarEvent, 'title' | 'start' | 'end' | 'allDay'> } | { ok: false; issue: DraftIssue } {
  const title = draft.title.trim();
  if (!title) return { ok: false, issue: { field: 'title', message: 'Add a title.' } };
  if (!draft.date) return { ok: false, issue: { field: 'date', message: 'Choose a date.' } };
  if (draft.allDay) {
    if (!draft.endDate) return { ok: false, issue: { field: 'endDate', message: 'Choose an end.' } };
    if (Temporal.PlainDate.compare(draft.endDate, draft.date) < 0) return { ok: false, issue: { field: 'endDate', message: 'End must be after the start.' } };
    const start = draft.date.toZonedDateTime({ timeZone, plainTime: MIDNIGHT });
    const end = draft.endDate.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: MIDNIGHT });
    return { ok: true, value: { title, start, end, allDay: true } };
  }
  if (!draft.start) return { ok: false, issue: { field: 'start', message: 'Choose a start.' } };
  if (!draft.end || !draft.endDate) return { ok: false, issue: { field: 'end', message: 'Choose an end.' } };
  const start = draft.date.toZonedDateTime({ timeZone, plainTime: draft.start });
  const end = draft.endDate.toZonedDateTime({ timeZone, plainTime: draft.end });
  if (Temporal.ZonedDateTime.compare(end, start) <= 0) return { ok: false, issue: { field: 'end', message: 'End must be after the start.' } };
  return { ok: true, value: { title, start, end, allDay: false } };
}

export function findConflicts(event: CalendarEvent, others: readonly CalendarEvent[]): { id: string }[] {
  return others.flatMap((other) =>
    other.id !== event.id &&
    Temporal.ZonedDateTime.compare(other.start, event.end) < 0 &&
    Temporal.ZonedDateTime.compare(event.start, other.end) < 0
      ? [{ id: other.id }]
      : [],
  );
}

type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

function weekStartsOn(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as WeekInfoLocale;
    const day = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    if (day && day >= 1 && day <= 7) return day;
  } catch {
    // A locale Intl cannot read keeps Sunday, as Calendar does.
  }
  return 7;
}

export function weekOf(day: Temporal.PlainDate, locale: string): Temporal.PlainDate[] {
  const start = day.subtract({ days: (day.dayOfWeek - weekStartsOn(locale) + 7) % 7 });
  return Array.from({ length: 7 }, (_, index) => start.add({ days: index }));
}

const MIDNIGHT = Temporal.PlainTime.from('00:00');

export function eventsOnDay(day: Temporal.PlainDate, events: readonly CalendarEvent[], timeZone: string, locale: string): CalendarEvent[] {
  const opens = zoned(day, MIDNIGHT, timeZone);
  const closes = zoned(day.add({ days: 1 }), MIDNIGHT, timeZone);
  return events
    .filter((event) => {
      if (event.allDay) {
        const covered = coveredDays(event, timeZone);
        return covered !== null && Temporal.PlainDate.compare(day, covered.first) >= 0 && Temporal.PlainDate.compare(day, covered.last) <= 0;
      }
      const start = event.start.withTimeZone(timeZone);
      const end = event.end.withTimeZone(timeZone);
      return Temporal.ZonedDateTime.compare(start, closes) < 0 && Temporal.ZonedDateTime.compare(end, opens) > 0;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      const key = (event: CalendarEvent) =>
        event.allDay ? (coveredDays(event, timeZone)?.first ?? event.start.toPlainDate()).toZonedDateTime({ timeZone, plainTime: MIDNIGHT }) : event.start.withTimeZone(timeZone);
      const byStart = Temporal.ZonedDateTime.compare(key(a), key(b));
      if (byStart !== 0) return byStart;
      return a.title.localeCompare(b.title, locale);
    });
}

/** The calendar days an event occupies. An end at midnight stays on the earlier day. An all-day event uses the dates in its own zone. */
function coveredDays(event: CalendarEvent, timeZone: string): { first: Temporal.PlainDate; last: Temporal.PlainDate } | null {
  const start = event.allDay ? event.start : event.start.withTimeZone(timeZone);
  const end = event.allDay ? event.end : event.end.withTimeZone(timeZone);
  if (Temporal.ZonedDateTime.compare(end, start) <= 0) return null;
  const first = start.toPlainDate();
  const last = end.toPlainTime().equals(MIDNIGHT) ? end.toPlainDate().subtract({ days: 1 }) : end.toPlainDate();
  if (Temporal.PlainDate.compare(last, first) < 0) return null;
  return { first, last };
}

function coversSeveralDays(event: CalendarEvent, timeZone: string): boolean {
  const covered = coveredDays(event, timeZone);
  return covered !== null && Temporal.PlainDate.compare(covered.last, covered.first) > 0;
}

export type WeekBar = {
  event: CalendarEvent;
  column: number;
  span: number;
  row: number;
  continuesFrom: boolean;
  continuesTo: boolean;
};

/**
 * Places each all-day event, and each event that covers more than one calendar
 * day, on a row of this week. Earlier starts take an earlier row. When two
 * start together, the longer span in this week takes the earlier row. A bar
 * that runs past either end of the week is split here and flagged.
 */
export function packWeekBars(events: readonly CalendarEvent[], days: readonly Temporal.PlainDate[], timeZone: string): WeekBar[] {
  if (days.length !== 7) throw new RangeError('a week has 7 days');
  const weekStart = days[0];
  const weekEnd = days[6];
  if (!weekStart || !weekEnd) throw new RangeError('a week has 7 days');

  const segments = events.flatMap((event, index) => {
    if (!event.allDay && !coversSeveralDays(event, timeZone)) return [];
    const covered = coveredDays(event, timeZone);
    if (!covered) return [];
    if (Temporal.PlainDate.compare(covered.last, weekStart) < 0 || Temporal.PlainDate.compare(covered.first, weekEnd) > 0) return [];
    const first = Temporal.PlainDate.compare(covered.first, weekStart) < 0 ? weekStart : covered.first;
    const last = Temporal.PlainDate.compare(covered.last, weekEnd) > 0 ? weekEnd : covered.last;
    const column = days.findIndex((day) => day.equals(first));
    const endColumn = days.findIndex((day) => day.equals(last));
    if (column < 0 || endColumn < column) return [];
    return [
      {
        event,
        column,
        span: endColumn - column + 1,
        continuesFrom: Temporal.PlainDate.compare(covered.first, weekStart) < 0,
        continuesTo: Temporal.PlainDate.compare(covered.last, weekEnd) > 0,
        index,
        start: event.allDay ? covered.first.toZonedDateTime({ timeZone, plainTime: MIDNIGHT }) : event.start.withTimeZone(timeZone),
      },
    ];
  });

  segments.sort((a, b) => Temporal.ZonedDateTime.compare(a.start, b.start) || b.span - a.span || a.index - b.index);

  const rowEnds: number[] = [];
  const placed = segments.map((segment) => {
    const end = segment.column + segment.span;
    let row = rowEnds.findIndex((used) => used <= segment.column);
    if (row < 0) {
      row = rowEnds.length;
      rowEnds.push(end);
    } else {
      rowEnds[row] = end;
    }
    return { ...segment, row };
  });
  placed.sort((a, b) => a.index - b.index);
  return placed.map(({ event, column, span, row, continuesFrom, continuesTo }) => ({ event, column, span, row, continuesFrom, continuesTo }));
}

export function laneScale(axis: DayAxis): number {
  return axis.segments.reduce((longest, segment) => Math.max(longest, segment.length), 0);
}

export type VisibleSpan = {
  event: CalendarEvent;
  day: Temporal.PlainDate;
  start: number;
  end: number;
};

/**
 * All-day events, and multi-day timed events the open hours never draw.
 * A 10 PM to 2 AM event misses 8:00–18:00, so the strip carries it. A timed
 * event the lanes can draw stays there, split across the days it meets.
 */
export function showsInStrip(event: CalendarEvent, timeZone: string, opens: Temporal.PlainTime, closes: Temporal.PlainTime): boolean {
  if (event.allDay) return true;
  const covered = coveredDays(event, timeZone);
  if (!covered || Temporal.PlainDate.compare(covered.last, covered.first) <= 0) return false;
  const days: Temporal.PlainDate[] = [];
  for (let day = covered.first; Temporal.PlainDate.compare(day, covered.last) <= 0; day = day.add({ days: 1 })) days.push(day);
  return visibleSpans(daySegments({ days, opens, closes, timeZone }), [event]).length === 0;
}

export function visibleSpans(axis: DayAxis, events: readonly CalendarEvent[]): VisibleSpan[] {
  const spans: VisibleSpan[] = [];
  for (const segment of axis.segments) {
    if (segment.length === 0) continue;
    for (const event of events) {
      if (event.allDay) continue;
      if (Temporal.ZonedDateTime.compare(event.start, segment.closes) >= 0) continue;
      if (Temporal.ZonedDateTime.compare(event.end, segment.opens) <= 0) continue;
      const clippedStart = Temporal.ZonedDateTime.compare(event.start, segment.opens) < 0 ? segment.opens : event.start;
      const clippedEnd = Temporal.ZonedDateTime.compare(event.end, segment.closes) > 0 ? segment.closes : event.end;
      const start = toUnits(axis, clippedStart, 'start');
      const end = toUnits(axis, clippedEnd, 'end');
      if (start === null || end === null || !start.day.equals(segment.day) || !end.day.equals(segment.day) || end.units <= start.units) continue;
      spans.push({ event, day: segment.day, start: start.units, end: end.units });
    }
  }
  return spans;
}

export function spanFrame(span: Pick<VisibleSpan, 'start' | 'end'>, scale: number): { top: number; height: number } {
  if (scale <= 0) throw new RangeError('scale must be greater than 0');
  return { top: span.start / scale, height: (span.end - span.start) / scale };
}

export type OverlapPlacement<T extends { start: number; end: number }> = {
  item: T;
  left: number;
  width: number;
  columns: number;
};

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

// A span with no length comes before a longer one that starts with it. Then the longer span takes the left column. Touching at an endpoint is not an overlap.
export function placeOverlaps<T extends { start: number; end: number }>(items: readonly T[]): OverlapPlacement<T>[] {
  const order = items.map((item, index) => ({ item, index }));
  order.sort(
    (a, b) =>
      a.item.start - b.item.start ||
      (a.item.end === a.item.start ? 0 : 1) - (b.item.end === b.item.start ? 0 : 1) ||
      b.item.end - a.item.end ||
      a.index - b.index,
  );

  const placed = new Map<number, { left: number; width: number; columns: number }>();
  let cluster: { index: number; column: number; item: T }[] = [];
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = columnEnds.length;
    for (const entry of cluster) {
      let span = 1;
      for (let column = entry.column + 1; column < columns; column += 1) {
        const taken = cluster.some((other) => other.column === column && rangesOverlap(entry.item, other.item));
        if (taken) break;
        span += 1;
      }
      placed.set(entry.index, { left: entry.column / columns, width: span / columns, columns });
    }
    cluster = [];
    columnEnds = [];
  };

  for (const entry of order) {
    const clusterEnd = columnEnds.reduce((end, value) => Math.max(end, value), Number.NEGATIVE_INFINITY);
    if (cluster.length > 0 && entry.item.start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= entry.item.start);
    if (column < 0) {
      column = columnEnds.length;
      columnEnds.push(entry.item.end);
    } else {
      columnEnds[column] = entry.item.end;
    }
    cluster.push({ index: entry.index, column, item: entry.item });
  }
  if (cluster.length > 0) flush();

  return items.map((item, index) => {
    const box = placed.get(index);
    if (!box) throw new Error('placeOverlaps left a span unpacked');
    return { item, left: box.left, width: box.width, columns: box.columns };
  });
}

export type HourMark = { units: number; time: Temporal.ZonedDateTime };

export function hourMarks(segment: DaySegment): HourMark[] {
  const marks: HourMark[] = [];
  for (let units = 0; units < segment.length; units += 60) {
    const time = fromUnits(segment, units, 'start');
    if (time) marks.push({ units, time });
  }
  return marks;
}

// Pinned so the page shows the same week whenever it opens.
const ZONE = 'America/Los_Angeles';
const OPENS = Temporal.PlainTime.from('08:00');
const CLOSES = Temporal.PlainTime.from('18:00');
const ANCHOR = Temporal.PlainDate.from('2026-11-16');

function at(day: string, clock: string): Temporal.ZonedDateTime {
  return Temporal.PlainDateTime.from(`${day}T${clock}`).toZonedDateTime(ZONE);
}

function timed(id: string, title: string, startDay: string, start: string, endDay: string, end: string, allDay = false): CalendarEvent {
  return { id, title, start: at(startDay, start), end: at(endDay, end), allDay };
}

const EVENTS: readonly CalendarEvent[] = [
  timed('review', 'Design review', '2026-11-16', '09:00', '2026-11-16', '10:30'),
  timed('standup', 'Standup', '2026-11-16', '09:00', '2026-11-16', '09:30'),
  timed('handoff', 'Handoff', '2026-11-16', '17:00', '2026-11-17', '09:30'),
  timed('interview', 'Interview', '2026-11-17', '10:00', '2026-11-17', '11:00'),
  timed('early', 'Early sync', '2026-11-18', '07:00', '2026-11-18', '09:00'),
  timed('workshop', 'Workshop', '2026-11-18', '14:00', '2026-11-18', '16:30'),
  timed('planning', 'Planning', '2026-11-19', '10:00', '2026-11-19', '12:00'),
  timed('one', '1:1', '2026-11-19', '11:00', '2026-11-19', '11:30'),
  timed('crit', 'Crit', '2026-11-19', '11:00', '2026-11-19', '12:30'),
  timed('ship', 'Ship review', '2026-11-19', '15:00', '2026-11-19', '18:30'),
  timed('hiring', 'Hiring loop', '2026-11-19', '15:30', '2026-11-19', '16:30'),
  timed('sync', 'Staff sync', '2026-11-19', '16:00', '2026-11-19', '17:00'),
  timed('demo', 'Demo', '2026-11-20', '13:00', '2026-11-20', '14:00'),
  timed('offsite', 'Offsite', '2026-11-16', '00:00', '2026-11-17', '00:00', true),
  timed('hours', 'Office hours', '2026-11-21', '11:00', '2026-11-21', '12:00'),
  timed('retreat', 'Retreat', '2026-11-20', '00:00', '2026-11-23', '00:00', true),
  timed('launch', 'Launch watch', '2026-11-18', '22:00', '2026-11-19', '02:00'),
];

const BOOK_CLUB: EventSeries = {
  id: seriesId('book-club'),
  title: 'Book club',
  timeZone: ZONE,
  start: at('2026-11-15', '15:00'),
  end: at('2026-11-15', '16:00'),
  allDay: false,
  rule: { freq: 'WEEKLY', interval: 1, byDay: ['SU'], end: { kind: 'never' } },
  exdates: [],
  overrides: [],
};

function initialSeries(source: readonly CalendarEvent[]): EventSeries[] {
  const list = source.map((event) =>
    seriesFromDraft(seriesId(event.seriesId ?? event.id), {
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      rule: null,
    }),
  );
  if (source === EVENTS) list.push(BOOK_CLUB);
  return list;
}

type CalendarView = 'month' | 'week' | 'day';

function visibleBounds(view: CalendarView, day: Temporal.PlainDate, locale: string, timeZone: string): ExpandWindow {
  if (view === 'month') {
    const first = day.with({ day: 1 });
    const last = first.add({ months: 1 }).subtract({ days: 1 });
    const leading = weekOf(first, locale)[0];
    const trailing = weekOf(last, locale)[6];
    if (!leading || !trailing) throw new RangeError('a week has 7 days');
    return { start: zoned(leading, MIDNIGHT, timeZone), end: zoned(trailing.add({ days: 1 }), MIDNIGHT, timeZone) };
  }
  const shown = view === 'week' ? weekOf(day, locale) : [day];
  const first = shown[0];
  const last = shown[shown.length - 1];
  if (!first || !last) throw new RangeError('a view has a day');
  return { start: zoned(first, MIDNIGHT, timeZone), end: zoned(last.add({ days: 1 }), MIDNIGHT, timeZone) };
}

function occurrenceEvent(occurrence: {
  id: string;
  seriesId: string;
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
  repeats: boolean;
  originalStart: Temporal.ZonedDateTime;
}): CalendarEvent {
  return occurrence;
}

function freshSeriesId(): SeriesId {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return seriesId(`event-${(values[0] ?? 0).toString(36)}-${(values[1] ?? 0).toString(36)}`);
}

function blankEvent(day: Temporal.PlainDate, open: Temporal.PlainTime, timeZone: string): CalendarEvent {
  const start = zoned(day, open, timeZone);
  return { id: 'draft', title: '', start, end: start.add({ minutes: SLOT_MINUTES }), allDay: false };
}

function firstOf(item: EventSeries): CalendarEvent | null {
  const occurrence = expandSeries(item, { start: item.start.subtract({ days: 1 }), end: item.end.add({ days: 1 }) })[0];
  return occurrence ? occurrenceEvent(occurrence) : null;
}

const MONTH_TITLES = 2;

function SyncTabStop({ onDay }: { onDay: (day: Temporal.PlainDate) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const iso = ref.current?.closest('table')?.querySelector('[data-todae-calendar-cell][tabindex="0"] [data-date]')?.getAttribute('data-date');
    if (!iso) return;
    onDay(Temporal.PlainDate.from(iso));
  });
  return <span ref={ref} hidden />;
}

function utcStamp(day: Temporal.PlainDate): number {
  return Date.UTC(day.year, day.month - 1, day.day);
}

function dayHeading(day: Temporal.PlainDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(utcStamp(day));
}

function rangeLabel(days: readonly Temporal.PlainDate[], locale: string): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  if (first.equals(last)) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(utcStamp(first));
  }
  const start = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(utcStamp(first));
  const end = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(utcStamp(last));
  return `${start} – ${end}`;
}

function sharedOffsets(segments: readonly DaySegment[]): Set<number> {
  const units = new Set<number>();
  for (const segment of segments) for (const mark of hourMarks(segment)) units.add(mark.units);
  const shared = new Set<number>();
  for (const at of units) {
    const times = segments.map((segment) => fromUnits(segment, at, 'start')?.toPlainTime() ?? null);
    const first = times[0];
    if (first && times.every((time) => time !== null && Temporal.PlainTime.compare(time, first) === 0)) shared.add(at);
  }
  return shared;
}

function clockLabel(at: Temporal.ZonedDateTime, locale: string, withDay: boolean): string {
  const time = formatTime(at.toPlainTime(), { locale });
  return withDay ? `${dayHeading(at.toPlainDate(), locale)}, ${time}` : time;
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 1e6) / 1e4}%`;
}

function daySpans(spans: readonly VisibleSpan[], day: Temporal.PlainDate, locale: string): VisibleSpan[] {
  return spans
    .filter((span) => span.day.equals(day))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.event.title.localeCompare(b.event.title, locale));
}

function dayTrack(columns: number): string {
  return `minmax(max(5.5rem, ${columns} * 4rem), 1fr)`;
}

function blockKey(id: string, day: Temporal.PlainDate): string {
  return `${id}@${day.toString()}`;
}

function stripKey(id: string): string {
  return `strip:${id}`;
}

/** A strip bar's grid lines. Column 1 is the gutter, and the end never passes the last day. */
function stripColumn(column: number, span: number, days: number): string {
  const start = column + 2;
  const end = Math.min(start + span, days + 2);
  return `${start} / ${end}`;
}

function eventRangeLabel(event: CalendarEvent, locale: string, timeZone: string): string {
  const covered = coveredDays(event, timeZone);
  if (!covered) return '';
  const format = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const stamp = (day: Temporal.PlainDate) => Date.UTC(day.year, day.month - 1, day.day);
  const start = format.format(stamp(covered.first));
  if (covered.first.equals(covered.last)) return start;
  return `${start} – ${format.format(stamp(covered.last))}`;
}

function barLabel(event: CalendarEvent, locale: string, timeZone: string): string {
  const range = eventRangeLabel(event, locale, timeZone);
  const base = event.allDay
    ? `${event.title}, ${range}`
    : `${event.title}, ${range}, ${formatTime(event.start.withTimeZone(timeZone).toPlainTime(), { locale })} to ${formatTime(event.end.withTimeZone(timeZone).toPlainTime(), { locale })}`;
  return event.repeats ? `${base}, repeats` : base;
}

type DrawnBar = WeekBar & { cutStart: boolean; cutEnd: boolean };

function barsOnBoard(events: readonly CalendarEvent[], week: readonly Temporal.PlainDate[], timeZone: string, opens: Temporal.PlainTime, closes: Temporal.PlainTime, day: Temporal.PlainDate | null): DrawnBar[] {
  const packed = packWeekBars(
    events.filter((event) => showsInStrip(event, timeZone, opens, closes)),
    week,
    timeZone,
  );
  const ordered = [...packed].sort((a, b) => a.row - b.row || a.column - b.column);
  if (!day) return ordered.map((bar) => ({ ...bar, cutStart: bar.continuesFrom, cutEnd: bar.continuesTo }));
  const index = week.findIndex((item) => item.equals(day));
  return ordered.flatMap((bar) => {
    if (index < bar.column || index >= bar.column + bar.span) return [];
    return [{ ...bar, column: 0, span: 1, cutStart: bar.continuesFrom || index > bar.column, cutEnd: bar.continuesTo || index < bar.column + bar.span - 1 }];
  });
}

function parseBlockKey(key: string): { id: string; day: string } {
  const at = key.lastIndexOf('@');
  return { id: key.slice(0, at), day: key.slice(at + 1) };
}

type ColumnShared = {
  locale: string;
  timeZone: string;
  days: number;
  scale: number;
  axis: DayAxis;
  week: boolean;
  lanes: UseLaneDragResult;
  landing: RefObject<HTMLButtonElement | null>;
  focusKey: string | null;
  onAdjust: (event: CalendarEvent, segment: DaySegment, change: SlotChange) => void;
  onEdit: (event: CalendarEvent, day: Temporal.PlainDate) => void;
  onDelete: (event: CalendarEvent, day: Temporal.PlainDate) => void;
};

function eventName(event: CalendarEvent, segment: DaySegment, locale: string, timeZone: string): { name: string; timeText: string; short: boolean } {
  const start = event.start.withTimeZone(timeZone);
  const end = event.end.withTimeZone(timeZone);
  const spansDays = !start.toPlainDate().equals(end.toPlainDate());
  const startLabel = clockLabel(start, locale, spansDays);
  const endLabel = clockLabel(end, locale, spansDays);
  const startedEarlier = Temporal.ZonedDateTime.compare(start, segment.opens) < 0;
  const continues = Temporal.ZonedDateTime.compare(end, segment.closes) > 0;
  const cue = [startedEarlier ? 'started earlier' : null, continues ? 'continues' : null, event.repeats ? 'repeats' : null].filter(Boolean).join(', ');
  const name = [`${event.title}, ${startLabel} to ${endLabel}`, cue].filter(Boolean).join(', ');
  const timeText = `${startedEarlier ? '…' : ''}${startLabel} to ${endLabel}${continues ? '…' : ''}`;
  const visible = clippedUnits(segment, event);
  const short = visible !== null && visible.end - visible.start < 45;
  return { name, timeText, short };
}

function EventMoves({ event, segment, axis, week, onAdjust, onEdit, onDelete }: Pick<ColumnShared, 'axis' | 'week' | 'onAdjust' | 'onEdit' | 'onDelete'> & { event: CalendarEvent; segment: DaySegment }) {
  if (event.allDay) {
    return (
      <>
        <Menu.Item onSelect={() => onAdjust(event, segment, { kind: 'day', days: -1 })}>Move to previous day</Menu.Item>
        <Menu.Item onSelect={() => onAdjust(event, segment, { kind: 'day', days: 1 })}>Move to next day</Menu.Item>
        <Menu.Separator />
        <Menu.Item onSelect={() => onEdit(event, segment.day)}>Edit…</Menu.Item>
        <Menu.Item onSelect={() => onDelete(event, segment.day)}>Delete</Menu.Item>
      </>
    );
  }
  const item = (change: SlotChange) => adjustEvent(event, segment, axis, change);
  const go = (change: SlotChange) => {
    const next = item(change);
    if (next) onAdjust(event, segment, change);
  };
  return (
    <>
      <Menu.Item disabled={item({ kind: 'shift', slots: -1 }) === null} onSelect={() => go({ kind: 'shift', slots: -1 })}>
        {`${SLOT_MINUTES} minutes earlier`}
      </Menu.Item>
      <Menu.Item disabled={item({ kind: 'shift', slots: 1 }) === null} onSelect={() => go({ kind: 'shift', slots: 1 })}>
        {`${SLOT_MINUTES} minutes later`}
      </Menu.Item>
      {week ? (
        <>
          <Menu.Item disabled={item({ kind: 'day', days: -1 }) === null} onSelect={() => go({ kind: 'day', days: -1 })}>
            Move to previous day
          </Menu.Item>
          <Menu.Item disabled={item({ kind: 'day', days: 1 }) === null} onSelect={() => go({ kind: 'day', days: 1 })}>
            Move to next day
          </Menu.Item>
        </>
      ) : null}
      <Menu.Separator />
      <Menu.Item disabled={item({ kind: 'length', slots: 1 }) === null} onSelect={() => go({ kind: 'length', slots: 1 })}>
        {`Lengthen ${SLOT_MINUTES} minutes`}
      </Menu.Item>
      <Menu.Item disabled={item({ kind: 'length', slots: -1 }) === null} onSelect={() => go({ kind: 'length', slots: -1 })}>
        {`Shorten ${SLOT_MINUTES} minutes`}
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item onSelect={() => onEdit(event, segment.day)}>Edit…</Menu.Item>
      <Menu.Item onSelect={() => onDelete(event, segment.day)}>Delete</Menu.Item>
    </>
  );
}

function EventBlock({ span, segment, shared }: { span: VisibleSpan & { left: number; width: number }; segment: DaySegment; shared: ColumnShared }) {
  const handoff = useFocusHandoff({ to: shared.landing });
  const key = blockKey(span.event.id, segment.day);
  const place = { lane: segment.day.toString(), start: span.start, end: span.end };
  const { name, timeText, short } = eventName(span.event, segment, shared.locale, shared.timeZone);
  const box = spanFrame(span, shared.scale);
  return (
    <li
      ref={handoff}
      {...shared.lanes.getItemProps(key, place)}
      className={styles.slot}
      style={{ top: percent(box.top), height: percent(box.height), insetInlineStart: percent(span.left), inlineSize: percent(span.width) }}
    >
      <Menu.Root>
        <Menu.Trigger
          {...shared.lanes.getHandleProps(key, 'move')}
          ref={key === shared.focusKey ? shared.landing : undefined}
          variant="ghost"
          className={styles.event}
          aria-label={name}
          tooltip={false}
        >
          <Text.Root as="span" weight="medium" lines={1}>
            {span.event.title}
          </Text.Root>
          {short ? null : (
            <Text.Root as="span" variant="label" tone="muted" lines={1}>
              {timeText}
            </Text.Root>
          )}
          {span.event.repeats ? (
            <Text.Root as="span" variant="label" tone="muted" lines={1}>
              Repeats
            </Text.Root>
          ) : null}
        </Menu.Trigger>
        <Menu.Content>
          <EventMoves event={span.event} segment={segment} axis={shared.axis} week={shared.week} onAdjust={shared.onAdjust} onEdit={shared.onEdit} onDelete={shared.onDelete} />
        </Menu.Content>
      </Menu.Root>
      <span {...shared.lanes.getHandleProps(key, 'start')} aria-hidden className={styles.edge} data-edge="start" />
      <span {...shared.lanes.getHandleProps(key, 'end')} aria-hidden className={styles.edge} data-edge="end" />
    </li>
  );
}

const DragPreview = memo(function DragPreview({ drag, segment, scale, locale }: { drag: UseLaneDragResult['drag']; segment: DaySegment; scale: number; locale: string }) {
  const change = useLaneDragState(drag, (state) => (state?.to?.lane === segment.day.toString() ? state : null));
  if (change?.to == null || scale <= 0) return null;
  const box = spanFrame({ start: change.to.start, end: change.to.end }, scale);
  const start = fromUnits(segment, change.to.start, 'start');
  const end = fromUnits(segment, change.to.end, 'end');
  const label = start && end ? `${formatTime(start.toPlainTime(), { locale })} to ${formatTime(end.toPlainTime(), { locale })}` : null;
  return (
    <div className={styles.preview} data-level={change.verdict?.level} style={{ top: percent(box.top), height: percent(box.height) }}>
      {label ? <span className={styles.previewTime}>{label}</span> : null}
    </div>
  );
});

function StripBar({ bar, segment, shared }: { bar: DrawnBar; segment: DaySegment; shared: ColumnShared }) {
  const handoff = useFocusHandoff({ to: shared.landing });
  const key = stripKey(bar.event.id);
  return (
    <div ref={handoff} className={styles.stripSlot} style={{ gridColumn: stripColumn(bar.column, bar.span, shared.days), gridRow: bar.row + 1 }}>
      <Menu.Root>
        <Menu.Trigger
          ref={key === shared.focusKey ? shared.landing : undefined}
          variant="ghost"
          className={styles.stripBar}
          aria-label={barLabel(bar.event, shared.locale, shared.timeZone)}
          data-bar={bar.event.id}
          data-cut-start={bar.cutStart ? '' : undefined}
          data-cut-end={bar.cutEnd ? '' : undefined}
          tooltip={false}
        >
          {bar.cutStart ? (
            <span aria-hidden="true" className={styles.cue}>
              …
            </span>
          ) : null}
          <Text.Root as="span" weight="medium" lines={1}>
            {bar.event.title}
          </Text.Root>
          {bar.event.repeats ? (
            <Text.Root as="span" variant="label" lines={1}>
              Repeats
            </Text.Root>
          ) : null}
          {bar.cutEnd ? (
            <span aria-hidden="true" className={styles.cueEnd}>
              …
            </span>
          ) : null}
        </Menu.Trigger>
        <Menu.Content>
          <EventMoves event={bar.event} segment={segment} axis={shared.axis} week={shared.week} onAdjust={shared.onAdjust} onEdit={shared.onEdit} onDelete={shared.onDelete} />
        </Menu.Content>
      </Menu.Root>
    </div>
  );
}

function EventColumn({
  segment,
  placed,
  sharedMarks,
  shared,
  headingId,
}: {
  segment: DaySegment;
  placed: ReturnType<typeof placeOverlaps<VisibleSpan>>;
  sharedMarks: ReadonlySet<number>;
  shared: ColumnShared;
  headingId: string;
}) {
  const marks = shared.scale > 0 ? hourMarks(segment) : [];
  return (
    <div {...shared.lanes.getLaneProps(segment.day.toString())} className={styles.column}>
      <div className={styles.hours} aria-hidden="true">
        {marks.map((mark) => {
          const top = percent(mark.units / shared.scale);
          const agreed = sharedMarks.has(mark.units);
          return (
            <div key={mark.units}>
              <div className={styles.line} style={{ top }} />
              {agreed ? null : (
                <Text.Root as="span" variant="label" tone="muted" className={styles.columnMark} data-first={mark.units === 0 ? '' : undefined} style={{ top }}>
                  {formatTime(mark.time.toPlainTime(), { locale: shared.locale })}
                </Text.Root>
              )}
            </div>
          );
        })}
      </div>
      <DragPreview drag={shared.lanes.drag} segment={segment} scale={shared.scale} locale={shared.locale} />
      <ol className={styles.events} aria-labelledby={headingId}>
        {placed.map(({ item, left, width }) => (
          <EventBlock key={blockKey(item.event.id, segment.day)} span={{ ...item, left, width }} segment={segment} shared={shared} />
        ))}
      </ol>
    </div>
  );
}

function MonthDay({ day, events, timeZone, locale }: { day: Temporal.PlainDate; events: readonly CalendarEvent[]; timeZone: string; locale: string }) {
  const list = eventsOnDay(day, events, timeZone, locale);
  if (list.length === 0) return null;
  const week = weekOf(day, locale);
  const bars = packWeekBars(events, week, timeZone);
  const index = week.findIndex((item) => item.equals(day));
  const covering = bars.filter((bar) => index >= bar.column && index < bar.column + bar.span);
  const visible = covering.filter((bar) => bar.row < MONTH_TITLES).sort((a, b) => a.row - b.row);
  const hidden = covering.length - visible.length;
  const barRows = visible.reduce((max, bar) => Math.max(max, bar.row + 1), 0);
  const placed = new Set(bars.map((bar) => bar.event.id));
  const chips = list.filter((event) => !placed.has(event.id));
  const shown = chips.slice(0, Math.max(0, MONTH_TITLES - visible.length));
  const extra = hidden + chips.length - shown.length;
  let spoken = 0;
  return (
    <>
      <span className={styles.detail} style={{ ['--bar-rows' as string]: barRows }}>
        {barRows > 0 ? (
          <span className={styles.barRows}>
            {visible.map((bar) => {
              const first = index === bar.column;
              const last = index === bar.column + bar.span - 1;
              const cutStart = bar.continuesFrom && first;
              const cutEnd = bar.continuesTo && last;
              const comma = spoken > 0;
              spoken += 1;
              return (
                <span
                  key={bar.event.id}
                  className={styles.monthBar}
                  data-bar={bar.event.id}
                  data-cut-start={cutStart ? '' : undefined}
                  data-cut-end={cutEnd ? '' : undefined}
                  data-join-start={first ? undefined : ''}
                  data-join-end={last ? undefined : ''}
                  style={{ gridRow: bar.row + 1 }}
                >
                  {comma ? <VisuallyHidden.Root>, </VisuallyHidden.Root> : null}
                  {cutStart ? (
                    <span aria-hidden="true" className={styles.cue}>
                      …
                    </span>
                  ) : null}
                  {index === bar.column ? <span className={styles.barLabel}>{bar.event.title}</span> : <VisuallyHidden.Root>{bar.event.title}</VisuallyHidden.Root>}
                  <VisuallyHidden.Root>{`, ${eventRangeLabel(bar.event, locale, timeZone)}`}</VisuallyHidden.Root>
                  {bar.event.repeats ? <VisuallyHidden.Root>, repeats</VisuallyHidden.Root> : null}
                  {bar.event.repeats && index === bar.column ? (
                    <span aria-hidden="true" className={styles.repeats}>
                      Repeats
                    </span>
                  ) : null}
                  {cutEnd ? (
                    <span aria-hidden="true" className={styles.cueEnd}>
                      …
                    </span>
                  ) : null}
                </span>
              );
            })}
          </span>
        ) : null}
        {shown.map((event) => {
          const comma = spoken > 0;
          spoken += 1;
          return (
            <span key={event.id} className={styles.chip}>
              {comma ? <VisuallyHidden.Root>, </VisuallyHidden.Root> : null}
              {event.title}
              {event.repeats ? <VisuallyHidden.Root>, repeats</VisuallyHidden.Root> : null}
              {event.repeats ? (
                <span aria-hidden="true" className={styles.repeats}>
                  {' '}
                  Repeats
                </span>
              ) : null}
            </span>
          );
        })}
        {extra > 0 ? (
          <span className={styles.more}>
            <VisuallyHidden.Root>, </VisuallyHidden.Root>
            {`+${extra} more`}
          </span>
        ) : null}
      </span>
      <span className={styles.count} aria-hidden="true">
        <span className={styles.dot} />
        {list.length}
      </span>
    </>
  );
}

export default function EventCalendarExample({
  locale = 'en-US',
  timeZone = ZONE,
  opens = OPENS,
  closes = CLOSES,
  anchor: initialAnchor = ANCHOR,
  events = EVENTS,
}: {
  locale?: string;
  timeZone?: string;
  opens?: Temporal.PlainTime;
  closes?: Temporal.PlainTime;
  anchor?: Temporal.PlainDate;
  events?: readonly CalendarEvent[];
}) {
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(initialAnchor);
  const [seriesList, setSeriesList] = useState<EventSeries[]>(() => initialSeries(events));
  const timedBefore = useRef(new Map<string, { start: Temporal.PlainTime; end: Temporal.PlainTime; daySpan: number }>());
  const [editing, setEditing] = useState<{ event: CalendarEvent; mode: 'create' | 'edit' } | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const heading = useId();
  const pendingFocus = useRef<'day' | null>(null);
  const landing = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);
  const focusHeading = useRef<Temporal.PlainDate | null>(null);
  const [pinFocus, setPinFocus] = useState(true);
  const announce = useAnnouncer();
  const bounds = visibleBounds(view, anchor, locale, timeZone);
  const items = seriesList.flatMap((item) => expandSeries(item, viewWindow(item, bounds)).map(occurrenceEvent));
  const editingSeries = editing ? (seriesList.find((item) => item.id === (editing.event.seriesId ?? editing.event.id)) ?? null) : null;
  const days = view === 'week' ? weekOf(anchor, locale) : [anchor];
  const week = weekOf(anchor, locale);
  const axis = daySegments({ days, opens, closes, timeZone });
  const scale = laneScale(axis);
  const spans = visibleSpans(axis, items);
  const lanes = axis.segments.map((segment) => {
    const placed = placeOverlaps(daySpans(spans, segment.day, locale));
    const columns = placed.reduce((count, place) => Math.max(count, place.columns), 1);
    return { segment, placed, columns };
  });
  const dayTracks = lanes.map((lane) => dayTrack(lane.columns)).join(' ');
  const tracks = `4.5rem ${dayTracks}`;
  const stripBars = view === 'month' ? [] : barsOnBoard(items, week, timeZone, opens, closes, view === 'day' ? anchor : null);
  const minInline = `${lanes.reduce((sum, lane) => sum + Math.max(5.5, lane.columns * 4), 4.5)}rem`;
  const sharedMarks = sharedOffsets(axis.segments);
  const gutterMarks = scale > 0 ? [...sharedMarks].sort((a, b) => a - b) : [];
  const step = view === 'week' ? 7 : 1;
  const move = view === 'week' ? 'week' : 'day';
  const grid = [...new Set(axis.segments.flatMap((segment) => snapGrid(segment, SLOT_MINUTES)))].sort((a, b) => a - b);

  const shownDay = (event: CalendarEvent, day: Temporal.PlainDate): Temporal.PlainDate | null => {
    if (event.allDay) return null;
    const around = view === 'day' ? [day.add({ days: -1 }), day, day.add({ days: 1 })] : weekOf(day, locale);
    const next = daySegments({ days: around, opens, closes, timeZone });
    return next.segments.find((segment) => clippedUnits(segment, event))?.day ?? null;
  };

  const commit = (next: CalendarEvent, day: Temporal.PlainDate) => {
    const current = items.find((each) => each.id === next.id) ?? next;
    const settled = finishGesture(current, next, 'drop');
    if (settled.allDay && !current.allDay) {
      const start = current.start.withTimeZone(timeZone);
      const end = current.end.withTimeZone(timeZone);
      timedBefore.current.set(settled.id, { start: start.toPlainTime(), end: end.toPlainTime(), daySpan: start.toPlainDate().until(end.toPlainDate(), { largestUnit: 'day' }).days });
    }
    if (!settled.allDay) timedBefore.current.delete(settled.id);
    const strip = showsInStrip(settled, timeZone, opens, closes);
    const laneHome = strip ? null : shownDay(settled, day);
    setFocusKey(strip ? stripKey(settled.id) : laneHome ? blockKey(settled.id, laneHome) : null);
    focusHeading.current = strip || laneHome ? null : day;
    setSeriesList((list) =>
      list.map((item) => {
        if (item.id !== (settled.seriesId ?? settled.id)) return item;
        if (settled.repeats && settled.originalStart) {
          return overrideOccurrence(item, settled.originalStart, { title: settled.title, start: settled.start, end: settled.end, allDay: settled.allDay });
        }
        return replaceSeries(item, { title: settled.title, start: settled.start, end: settled.end, allDay: settled.allDay, rule: item.rule });
      }),
    );
    const start = settled.start.withTimeZone(timeZone);
    const end = settled.end.withTimeZone(timeZone);
    const spansDays = !start.toPlainDate().equals(end.toPlainDate());
    announce(strip ? barLabel(settled, locale, timeZone) : `${settled.title}, ${clockLabel(start, locale, spansDays)} to ${clockLabel(end, locale, spansDays)}`);
    returnFocus.current = true;
  };

  // The dialog unmounts in the same commit that records the edit, so its own
  // focus return has no button to land on yet. This runs after that commit.
  useLayoutEffect(() => {
    if (!returnFocus.current || editing || deleting) return;
    returnFocus.current = false;
    const day = focusHeading.current;
    if (day) {
      document.getElementById(`${heading}-${day.toString()}`)?.focus();
      return;
    }
    if (landing.current?.isConnected) landing.current.focus();
  }, [anchor, deleting, editing, focusKey, heading, seriesList]);

  const board = useLaneDrag({
    range: { start: 0, end: Math.max(scale, SLOT_MINUTES) },
    axis: 'block',
    grid,
    minSpan: SLOT_MINUTES,
    disabled: view === 'month' || scale === 0,
    check: (_id, to) => {
      const segment = axis.segments.find((each) => each.day.toString() === to.lane);
      if (!segment || to.end > segment.length || to.end - to.start < SLOT_MINUTES) return { level: 'blocked', reason: 'Outside this day' };
      return null;
    },
    onDrop: (change) => {
      if (change.to === null || change.from === null) return;
      if (change.kind !== 'move' && change.kind !== 'resize-start' && change.kind !== 'resize-end') return;
      const { id } = parseBlockKey(change.id);
      const event = items.find((each) => each.id === id);
      const fromDay = axis.segments.find((each) => each.day.toString() === change.from?.lane)?.day;
      const toDay = axis.segments.find((each) => each.day.toString() === change.to?.lane)?.day;
      if (!event || !fromDay || !toDay) return;
      const next = eventFromLane(event, { from: { day: fromDay, start: change.from.start, end: change.from.end }, to: { day: toDay, start: change.to.start, end: change.to.end }, kind: change.kind }, axis);
      const settled = finishGesture(event, next, 'drop');
      if (settled !== event) commit(settled, toDay);
    },
  });

  const onAdjust = (event: CalendarEvent, segment: DaySegment, change: SlotChange) => {
    if (event.allDay && change.kind === 'day') {
      const next = { ...event, start: event.start.add({ days: change.days }), end: event.end.add({ days: change.days }) };
      commit(next, segment.day.add({ days: change.days }));
      return;
    }
    const next = adjustEvent(event, segment, axis, change);
    if (!next) return;
    const day = change.kind === 'day' ? segment.day.add({ days: change.days }) : segment.day;
    commit(next, day);
  };

  const onEdit = (event: CalendarEvent, day: Temporal.PlainDate) => {
    setFocusKey(showsInStrip(event, timeZone, opens, closes) ? stripKey(event.id) : blockKey(event.id, day));
    setEditing({ event, mode: 'edit' });
  };

  const onDelete = (event: CalendarEvent, day: Temporal.PlainDate) => {
    setFocusKey(showsInStrip(event, timeZone, opens, closes) ? stripKey(event.id) : blockKey(event.id, day));
    if (event.repeats) {
      setDeleting(event);
      return;
    }
    setSeriesList((list) => list.filter((item) => item.id !== (event.seriesId ?? event.id)));
    focusHeading.current = day;
    setFocusKey(null);
    announce(`Deleted ${event.title}.`);
    returnFocus.current = true;
  };

  const finishDelete = (scope: EditScope) => {
    const event = deleting;
    if (!event?.originalStart) return;
    const id = event.seriesId ?? event.id;
    setSeriesList((list) =>
      list.flatMap((item) => {
        if (item.id !== id) return [item];
        if (scope === 'series') return [];
        if (scope === 'occurrence') return [excludeOccurrence(item, event.originalStart!)];
        const kept = truncateBefore(item, event.originalStart!);
        return kept ? [kept] : [];
      }),
    );
    const which = scope === 'occurrence' ? 'this event' : scope === 'following' ? 'this and following events' : 'all events';
    announce(`Deleted ${which}. ${event.title}.`);
    focusHeading.current = event.start.withTimeZone(timeZone).toPlainDate();
    setFocusKey(null);
    returnFocus.current = true;
    setDeleting(null);
  };

  const columnShared: ColumnShared = {
    locale,
    timeZone,
    days: days.length,
    scale,
    axis,
    week: view === 'week',
    lanes: board,
    landing,
    focusKey,
    onAdjust,
    onEdit,
    onDelete,
  };

  useLayoutEffect(() => {
    setPinFocus(view !== 'month');
  }, [view]);

  useLayoutEffect(() => {
    if (pendingFocus.current !== 'day' || view !== 'day') return;
    pendingFocus.current = null;
    const id = `${heading}-${anchor.toString()}`;
    const list = [...document.querySelectorAll<HTMLElement>('[aria-labelledby]')].find((el) => el.getAttribute('aria-labelledby') === id);
    const button = list?.querySelector<HTMLElement>('button');
    if (button) {
      button.focus();
      return;
    }
    document.getElementById(id)?.focus();
  }, [anchor, heading, view]);

  const openDay = (day: Temporal.PlainDate) => {
    pendingFocus.current = 'day';
    setAnchor(day);
    setView('day');
  };

  const keepAnchor = (day: Temporal.PlainDate) => {
    setAnchor((current) => (current.equals(day) ? current : day));
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.toolbar}>
        <ToggleGroup.Root
          aria-label="Calendar view"
          value={view}
          onValueChange={(value) => {
            if (value === 'month' || value === 'week' || value === 'day') setView(value);
          }}
        >
          <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
          <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
          <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Button.Root variant="secondary" onClick={() => setEditing({ mode: 'create', event: blankEvent(anchor, opens, timeZone) })}>
          New event
        </Button.Root>
        {view === 'month' ? null : (
          <>
            <Button.Root variant="secondary" onClick={() => setAnchor((day) => day.add({ days: -step }))}>
              {`Previous ${move}`}
            </Button.Root>
            <Button.Root variant="secondary" onClick={() => setAnchor((day) => day.add({ days: step }))}>
              {`Next ${move}`}
            </Button.Root>
            <Text.Root className={styles.range}>{rangeLabel(days, locale)}</Text.Root>
          </>
        )}
      </div>
      {view === 'month' ? (
        <Calendar.Root
          className={styles.month}
          locale={locale}
          // value starts the tab stop on the anchor day. Clearing it before paint leaves that day focused and not selected.
          value={pinFocus ? anchor : null}
          onValueChange={openDay}
        >
          <Calendar.Header />
          <Calendar.Grid
            showOutsideDays
            renderDay={(day) => (
              <span className={styles.chips} data-date={day.date.toString()}>
                <span className={styles.dateRow}>
                  {day.today ? (
                    <span className={styles.dateMark} aria-hidden="true">
                      {day.date.day}
                    </span>
                  ) : null}
                </span>
                {day.date.day === 1 && !day.outside ? <SyncTabStop onDay={keepAnchor} /> : null}
                <MonthDay day={day.date} events={items} timeZone={timeZone} locale={locale} />
              </span>
            )}
          />
        </Calendar.Root>
      ) : (
        <ScrollArea.Root {...board.getBoardProps()} axis="both" focusable aria-label="Calendar" className={styles.board}>
          <div
            className={styles.frame}
            style={{
              ['--days' as string]: days.length,
              ['--minutes' as string]: scale,
              ['--min-inline' as string]: minInline,
              ['--tracks' as string]: tracks,
              ['--day-tracks' as string]: dayTracks,
            }}
          >
            <div className={styles.head}>
              <div className={styles.corner} />
              {axis.segments.map((segment) => (
                <Text.Root as="h3" variant="label" tabIndex={-1} id={`${heading}-${segment.day.toString()}`} key={segment.day.toString()} className={styles.day}>
                  {dayHeading(segment.day, locale)}
                </Text.Root>
              ))}
            </div>
            {stripBars.length === 0 ? null : (
              <div className={styles.strip}>
                <div className={styles.corner} />
                {stripBars.map((bar) => {
                  const segment = axis.segments[view === 'day' ? 0 : bar.column] ?? axis.segments[0];
                  if (!segment) return null;
                  return <StripBar key={bar.event.id} bar={bar} segment={segment} shared={columnShared} />;
                })}
              </div>
            )}
            <div className={styles.body}>
              <div className={styles.gutter} aria-hidden="true">
                {gutterMarks.map((units) => {
                  const time = axis.segments.map((segment) => fromUnits(segment, units, 'start')).find((value) => value !== null);
                  if (!time) return null;
                  return (
                    <Text.Root
                      as="span"
                      key={units}
                      variant="label"
                      tone="muted"
                      className={styles.mark}
                      data-first={units === 0 ? '' : undefined}
                      style={{ top: percent(units / scale) }}
                    >
                      {formatTime(time.toPlainTime(), { locale })}
                    </Text.Root>
                  );
                })}
              </div>
              {lanes.map(({ segment, placed }) => (
                <EventColumn
                  key={segment.day.toString()}
                  segment={segment}
                  placed={placed}
                  sharedMarks={sharedMarks}
                  shared={columnShared}
                  headingId={`${heading}-${segment.day.toString()}`}
                />
              ))}
            </div>
          </div>
        </ScrollArea.Root>
      )}
      {editing ? (
        <EventEditor
          event={editing.event}
          mode={editing.mode}
          locale={locale}
          timeZone={timeZone}
          opens={opens}
          prior={timedBefore.current.get(editing.event.id) ?? null}
          rule={editingSeries?.rule ?? null}
          template={
            editingSeries
              ? { id: editingSeries.id, seriesId: editingSeries.id, title: editingSeries.title, start: editingSeries.start, end: editingSeries.end, allDay: editingSeries.allDay, repeats: editingSeries.rule !== null, originalStart: editingSeries.start }
              : null
          }
          chooseScope={editing.mode === 'edit' && editing.event.repeats === true}
          restoreFocusRef={landing}
          onCancel={() => {
            returnFocus.current = true;
            setEditing(null);
          }}
          onSave={(next, detail) => {
            const day = next.start.withTimeZone(timeZone).toPlainDate();
            const labelOf = (saved: CalendarEvent) => {
              const strip = showsInStrip(saved, timeZone, opens, closes);
              const start = saved.start.withTimeZone(timeZone);
              const end = saved.end.withTimeZone(timeZone);
              const spansDays = !start.toPlainDate().equals(end.toPlainDate());
              return strip ? barLabel(saved, locale, timeZone) : `${saved.title}, ${clockLabel(start, locale, spansDays)} to ${clockLabel(end, locale, spansDays)}`;
            };
            const reveal = (saved: CalendarEvent, message?: string) => {
              const home = shownDay(saved, day);
              setAnchor(home ?? day);
              if (saved.allDay && !editing.event.allDay) {
                const start = editing.event.start.withTimeZone(timeZone);
                const end = editing.event.end.withTimeZone(timeZone);
                timedBefore.current.set(saved.id, { start: start.toPlainTime(), end: end.toPlainTime(), daySpan: start.toPlainDate().until(end.toPlainDate(), { largestUnit: 'day' }).days });
              }
              if (!saved.allDay) timedBefore.current.delete(saved.id);
              const strip = showsInStrip(saved, timeZone, opens, closes);
              const laneHome = strip ? null : shownDay(saved, home ?? day);
              setFocusKey(strip ? stripKey(saved.id) : laneHome ? blockKey(saved.id, laneHome) : null);
              focusHeading.current = strip || laneHome ? null : (home ?? day);
              announce(message ?? labelOf(saved));
              returnFocus.current = true;
            };
            if (editing.mode === 'create') {
              const created = seriesFromDraft(freshSeriesId(), { title: next.title, start: next.start, end: next.end, allDay: next.allDay, rule: detail.rule });
              setSeriesList((list) => [...list, created]);
              const saved = firstOf(created) ?? { ...next, id: created.id, seriesId: created.id, repeats: detail.rule !== null, originalStart: next.start };
              reveal(saved, `Created ${labelOf(saved)}.`);
              setEditing(null);
              return;
            }
            const current = seriesList.find((item) => item.id === (editing.event.seriesId ?? editing.event.id));
            if (!current) return;
            if (detail.scope === 'occurrence' && editing.event.originalStart) {
              setSeriesList((list) => list.map((item) => (item.id === current.id ? overrideOccurrence(item, editing.event.originalStart!, { title: next.title, start: next.start, end: next.end, allDay: next.allDay }) : item)));
              const saved = { ...editing.event, ...next, id: editing.event.id, seriesId: current.id, repeats: true, originalStart: editing.event.originalStart };
              reveal(saved, `Changed this event. ${labelOf(saved)}.`);
            } else if (detail.scope === 'following' && editing.event.originalStart) {
              const created = seriesFromDraft(freshSeriesId(), { title: next.title, start: next.start, end: next.end, allDay: next.allDay, rule: detail.rule });
              const previous = truncateBefore(current, editing.event.originalStart);
              setSeriesList((list) => list.flatMap((item) => (item.id === current.id ? (previous ? [previous, created] : [created]) : [item])));
              const saved = firstOf(created) ?? { ...next, id: created.id, seriesId: created.id, repeats: detail.rule !== null, originalStart: next.start };
              reveal(saved, `Changed this and following events. ${labelOf(saved)}.`);
            } else {
              const replaced = replaceSeries(current, { title: next.title, start: next.start, end: next.end, allDay: next.allDay, rule: detail.rule });
              setSeriesList((list) => list.map((item) => (item.id === current.id ? replaced : item)));
              const saved = firstOf(replaced) ?? { ...next, id: replaced.id, seriesId: replaced.id, repeats: detail.rule !== null, originalStart: next.start };
              reveal(saved, editing.event.repeats ? `Changed all events. ${labelOf(saved)}.` : undefined);
            }
            setEditing(null);
          }}
        />
      ) : null}
      {deleting ? (
        <ScopeChoice
          intent="delete"
          restoreFocusRef={landing}
          onCancel={() => {
            returnFocus.current = true;
            setDeleting(null);
          }}
          onChoose={finishDelete}
        />
      ) : null}
    </div>
  );
}

const WEEK_FROM_SUNDAY: readonly ByDay[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function orderedDays(locale: string): ByDay[] {
  const sunday = Temporal.PlainDate.from('2026-11-15');
  const start = weekOf(sunday, locale)[0] ?? sunday;
  return Array.from({ length: 7 }, (_, index) => byDayOf(start.add({ days: index })));
}

function weekdayName(day: ByDay, locale: string): string {
  const date = Temporal.PlainDate.from('2026-11-15').add({ days: WEEK_FROM_SUNDAY.indexOf(day) });
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(date.year, date.month - 1, date.day));
}

type RepeatFields = {
  freq: 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  byDay: ByDay[];
  end: 'never' | 'count' | 'until';
  count: number | null;
  until: Temporal.PlainDate | null;
};

function draftFromEvent(event: CalendarEvent, timeZone: string): EventDraft {
  const start = event.start.withTimeZone(timeZone);
  const end = event.end.withTimeZone(timeZone);
  const covered = event.allDay ? coveredDays(event, timeZone) : null;
  return {
    title: event.title,
    date: covered?.first ?? start.toPlainDate(),
    endDate: covered?.last ?? end.toPlainDate(),
    start: start.toPlainTime(),
    end: end.toPlainTime(),
    allDay: event.allDay,
  };
}

function repeatFromRule(rule: RecurrenceRule | null, day: Temporal.PlainDate): RepeatFields {
  return {
    freq: rule?.freq ?? 'none',
    byDay: rule?.byDay ? [...rule.byDay] : [byDayOf(day)],
    end: rule?.end.kind ?? 'never',
    count: rule?.end.kind === 'count' ? rule.end.count : 10,
    until: rule?.end.kind === 'until' ? rule.end.until.toPlainDate() : null,
  };
}

function endOfChosenDay(date: Temporal.PlainDate, timeZone: string): Temporal.ZonedDateTime {
  return zoned(date.add({ days: 1 }), MIDNIGHT, timeZone).subtract({ nanoseconds: 1 });
}

function ruleFromRepeat(fields: RepeatFields, timeZone: string): RecurrenceRule | null | string {
  if (fields.freq === 'none') return null;
  if (fields.freq === 'WEEKLY' && fields.byDay.length === 0) return 'Choose at least one day.';
  if (fields.end === 'count' && (fields.count === null || !Number.isInteger(fields.count) || fields.count < 1)) return 'Choose how many times it repeats.';
  if (fields.end === 'until' && !fields.until) return 'Choose the last date.';
  const byDay = fields.freq === 'WEEKLY' ? fields.byDay : undefined;
  if (fields.end === 'count') return { freq: fields.freq, interval: 1, byDay, end: { kind: 'count', count: fields.count ?? 1 } };
  if (fields.end === 'until' && fields.until) return { freq: fields.freq, interval: 1, byDay, end: { kind: 'until', until: endOfChosenDay(fields.until, timeZone) } };
  return { freq: fields.freq, interval: 1, byDay, end: { kind: 'never' } };
}

function ScopeChoice({
  intent,
  onChoose,
  onCancel,
  restoreFocusRef,
}: {
  intent: 'edit' | 'delete';
  onChoose: (scope: EditScope) => void;
  onCancel: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const verb = intent === 'delete' ? 'Delete' : 'Edit';
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()} initialFocusRef={first} restoreFocusRef={restoreFocusRef} aria-describedby={descriptionId}>
      <div className={styles.fields}>
        <Dialog.Header>
          <Dialog.Title id={titleId}>{`${verb} repeating event`}</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <p id={descriptionId}>{`This event repeats. Choose which events to ${intent}.`}</p>
          <div className={styles.scopeChoices} role="group" aria-labelledby={titleId}>
            <Button.Root ref={first} variant="secondary" onClick={() => onChoose('occurrence')}>
              This event
            </Button.Root>
            <Button.Root variant="secondary" onClick={() => onChoose('following')}>
              This and following
            </Button.Root>
            <Button.Root variant="secondary" onClick={() => onChoose('series')}>
              All events
            </Button.Root>
          </div>
        </Dialog.Body>
      </div>
    </Dialog.Root>
  );
}

/**
 * Edits one event's title and time, and, for a new event or a whole series, how it repeats.
 * Drag-to-create can open it with the event a drag sketched and read the saved event from `onSave`.
 */
export function EventEditor({
  event,
  locale,
  timeZone,
  opens = OPENS,
  prior = null,
  mode = 'edit',
  rule = null,
  template = null,
  chooseScope = false,
  onSave,
  onCancel,
  restoreFocusRef,
}: {
  event: CalendarEvent;
  locale: string;
  timeZone: string;
  opens?: Temporal.PlainTime;
  prior?: { start: Temporal.PlainTime; end: Temporal.PlainTime; daySpan: number } | null;
  mode?: 'create' | 'edit';
  rule?: RecurrenceRule | null;
  template?: CalendarEvent | null;
  /** A repeating event asks which occurrences the edit applies to before the fields. */
  chooseScope?: boolean;
  onSave: (event: CalendarEvent, detail: { rule: RecurrenceRule | null; scope: EditScope }) => void;
  onCancel: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ids = { title: useId(), date: useId(), endDate: useId(), start: useId(), end: useId(), dialog: useId(), ask: useId(), repeat: useId(), count: useId(), until: useId() };
  const titleRef = useRef<HTMLInputElement>(null);
  const choiceRef = useRef<HTMLButtonElement>(null);
  const remembered = useRef<{ start: Temporal.PlainTime | null; end: Temporal.PlainTime | null; endDate?: Temporal.PlainDate | null; daySpan?: number } | null>(prior);
  const [scope, setScope] = useState<EditScope | null>(chooseScope ? null : 'series');
  const [fields, setFields] = useState<EventDraft>(() => draftFromEvent(event, timeZone));
  const [repeat, setRepeat] = useState<RepeatFields>(() => repeatFromRule(rule, event.start.withTimeZone(timeZone).toPlainDate()));
  const [errors, setErrors] = useState<FormErrors>({});
  const asking = chooseScope && scope === null;
  useLayoutEffect(() => {
    if (asking || !chooseScope) return;
    titleRef.current?.focus();
  }, [asking, chooseScope]);
  const edit =
    <K extends keyof EventDraft>(key: K) =>
    (value: EventDraft[K]) => {
      setErrors({});
      setFields((current) => shiftDraft(current, key, value, timeZone));
    };
  const setAllDay = (on: boolean) => {
    setErrors({});
    setFields((current) => {
      if (on) {
        const blank = current.start?.equals(MIDNIGHT) && current.end?.equals(MIDNIGHT);
        if (!blank) remembered.current = { start: current.start, end: current.end, endDate: current.endDate };
        let endDate = current.endDate;
        if (current.end?.equals(MIDNIGHT) && endDate && current.date && Temporal.PlainDate.compare(endDate, current.date) > 0) endDate = endDate.subtract({ days: 1 });
        return { ...current, allDay: true, endDate: endDate ?? current.date };
      }
      const kept = remembered.current;
      const usable = kept?.start && kept.end && !(kept.start.equals(MIDNIGHT) && kept.end.equals(MIDNIGHT));
      if (usable && kept) {
        const endDate = current.date && typeof kept.daySpan === 'number' ? current.date.add({ days: kept.daySpan }) : (kept.endDate ?? current.date);
        return { ...current, allDay: false, start: kept.start, end: kept.end, endDate };
      }
      return { ...current, allDay: false, start: opens, end: opens.add({ minutes: SLOT_MINUTES }), endDate: current.date };
    });
  };
  const pickScope = (next: EditScope) => {
    setScope(next);
    if (next === 'series' && template) {
      setFields(draftFromEvent(template, timeZone));
      setRepeat(repeatFromRule(rule, template.start.withTimeZone(timeZone).toPlainDate()));
    }
  };

  const submit = (submitEvent: SubmitEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const result = eventFromDraft(fields, timeZone);
    if (!result.ok) {
      setErrors({ [result.issue.field]: result.issue.message });
      return;
    }
    const showRepeat = scope !== 'occurrence';
    const parsed = showRepeat ? ruleFromRepeat(repeat, timeZone) : null;
    if (typeof parsed === 'string') {
      setErrors({ repeat: parsed });
      return;
    }
    onSave({ ...event, ...result.value }, { rule: parsed, scope: scope ?? 'series' });
  };

  const dialogTitle = mode === 'create' ? 'New event' : asking ? 'Edit repeating event' : `Edit ${fields.title || event.title}`;
  const days = orderedDays(locale);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()} initialFocusRef={asking ? choiceRef : titleRef} restoreFocusRef={restoreFocusRef} aria-describedby={asking ? ids.ask : undefined}>
      {asking ? (
        <div className={styles.fields}>
          <Dialog.Header>
            <Dialog.Title id={ids.dialog}>{dialogTitle}</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <p id={ids.ask}>This event repeats. Choose which events to edit.</p>
            <div className={styles.scopeChoices} role="group" aria-labelledby={ids.dialog}>
              <Button.Root ref={choiceRef} variant="secondary" onClick={() => pickScope('occurrence')}>
                This event
              </Button.Root>
              <Button.Root variant="secondary" onClick={() => pickScope('following')}>
                This and following
              </Button.Root>
              <Button.Root variant="secondary" onClick={() => pickScope('series')}>
                All events
              </Button.Root>
            </div>
          </Dialog.Body>
        </div>
      ) : (
        <Form.Root errors={errors} onSubmit={submit} aria-labelledby={ids.dialog} className={styles.fields}>
          <Dialog.Header>
            <Dialog.Title id={ids.dialog}>{dialogTitle}</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <Field.Group>
              <Label.Root htmlFor={ids.title}>Title</Label.Root>
              <Field.Root id={ids.title} name="title">
                <Field.TextInput ref={titleRef} required value={fields.title} onValueChange={edit('title')} />
              </Field.Root>
              <ErrorMessage.Root />
            </Field.Group>
            <Field.Group>
              <Label.Root htmlFor={ids.date}>Date</Label.Root>
              <Field.Root id={ids.date} name="date">
                <Field.DateInput required value={fields.date} onValueChange={edit('date')} locale={locale} />
              </Field.Root>
              <ErrorMessage.Root />
            </Field.Group>
            <Switch.Root className={styles.allDay} checked={fields.allDay} onCheckedChange={setAllDay}>
              All day
            </Switch.Root>
            {fields.allDay ? null : (
              <Field.Group>
                <Label.Root htmlFor={ids.start}>Start</Label.Root>
                <Field.Root id={ids.start} name="start">
                  <Field.TimeInput required value={fields.start} onValueChange={edit('start')} locale={locale} />
                </Field.Root>
                <ErrorMessage.Root />
              </Field.Group>
            )}
            <Field.Group>
              <Label.Root htmlFor={ids.endDate}>End date</Label.Root>
              <Field.Root id={ids.endDate} name="endDate">
                <Field.DateInput required value={fields.endDate} onValueChange={edit('endDate')} locale={locale} />
              </Field.Root>
              <ErrorMessage.Root />
            </Field.Group>
            {fields.allDay ? null : (
              <Field.Group>
                <Label.Root htmlFor={ids.end}>End</Label.Root>
                <Field.Root id={ids.end} name="end">
                  <Field.TimeInput required value={fields.end} onValueChange={edit('end')} locale={locale} />
                </Field.Root>
                <ErrorMessage.Root />
              </Field.Group>
            )}
            {scope === 'occurrence' ? null : (
              <Field.Group>
                <Label.Root htmlFor={ids.repeat}>Repeat</Label.Root>
                <Field.Root id={ids.repeat} name="repeat">
                  <Field.Select
                    value={repeat.freq}
                    onValueChange={(value) => {
                      setErrors({});
                      const freq = value === 'DAILY' || value === 'WEEKLY' || value === 'MONTHLY' || value === 'YEARLY' ? value : 'none';
                      setRepeat((current) => ({
                        ...current,
                        freq,
                        byDay: freq === 'WEEKLY' && current.byDay.length === 0 && fields.date ? [byDayOf(fields.date)] : current.byDay,
                      }));
                    }}
                  >
                    <option value="none">None</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </Field.Select>
                </Field.Root>
                <ErrorMessage.Root />
              </Field.Group>
            )}
            {scope === 'occurrence' || repeat.freq !== 'WEEKLY' ? null : (
              <ToggleGroup.Root
                aria-label="Days"
                selectionMode="multiple"
                value={repeat.byDay}
                onValueChange={(value) => {
                  setErrors({});
                  setRepeat((current) => ({ ...current, byDay: value.filter((day): day is ByDay => WEEK_FROM_SUNDAY.includes(day as ByDay)) }));
                }}
                className={styles.repeatDays}
              >
                {days.map((day) => (
                  <ToggleGroup.Item key={day} value={day}>
                    {weekdayName(day, locale)}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            )}
            {scope === 'occurrence' || repeat.freq === 'none' ? null : (
              <>
                <RadioGroup.Root
                  aria-label="Ends"
                  value={repeat.end}
                  onValueChange={(value) => {
                    if (value === 'never' || value === 'count' || value === 'until') setRepeat((current) => ({ ...current, end: value }));
                  }}
                >
                  <RadioGroup.Item value="never">Never</RadioGroup.Item>
                  <RadioGroup.Item value="count">After</RadioGroup.Item>
                  <RadioGroup.Item value="until">On</RadioGroup.Item>
                </RadioGroup.Root>
                {repeat.end === 'count' ? (
                  <Field.Group>
                    <Label.Root htmlFor={ids.count}>Times</Label.Root>
                    <Field.Root id={ids.count} name="count">
                      <Field.NumberInput min={1} step={1} value={repeat.count} onValueChange={(count) => setRepeat((current) => ({ ...current, count }))} locale={locale} />
                    </Field.Root>
                    <ErrorMessage.Root />
                  </Field.Group>
                ) : null}
                {repeat.end === 'until' ? (
                  <Field.Group>
                    <Label.Root htmlFor={ids.until}>Last date</Label.Root>
                    <Field.Root id={ids.until} name="until">
                      <Field.DateInput value={repeat.until} onValueChange={(until) => setRepeat((current) => ({ ...current, until }))} locale={locale} />
                    </Field.Root>
                    <ErrorMessage.Root />
                  </Field.Group>
                ) : null}
              </>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close>Cancel</Dialog.Close>
            <Button.Root type="submit">Save</Button.Root>
          </Dialog.Footer>
        </Form.Root>
      )}
    </Dialog.Root>
  );
}
