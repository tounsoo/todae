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
import styles from './EventCalendar.module.css';

export type CalendarEvent = {
  id: string;
  title: string;
  seriesId?: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
};

/** An absolute instant, or a zoned value whose instant is what the grid places. */
export type CalendarPoint = Temporal.ZonedDateTime | Temporal.Instant;

/** A value the grid can be given. An all-day event keeps the zone it was written in. */
export type CalendarEventInput = Omit<CalendarEvent, 'start' | 'end'> & {
  start: CalendarPoint;
  end: CalendarPoint;
};

/** The instant as a zoned value in `timeZone`. A zoned value keeps that instant. */
export function inZone(value: CalendarPoint, timeZone: string): Temporal.ZonedDateTime {
  return value instanceof Temporal.Instant ? value.toZonedDateTimeISO(timeZone) : value.withTimeZone(timeZone);
}

function projectEvent(event: CalendarEventInput, timeZone: string): CalendarEvent {
  const keep = (value: CalendarPoint) => (event.allDay && value instanceof Temporal.ZonedDateTime ? value : inZone(value, timeZone));
  return { ...event, start: keep(event.start), end: keep(event.end) };
}

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

/** A new event for a snapped place on `segment`. The title is empty until the dialog saves it. */
export function eventFromPlace(segment: DaySegment, start: number, end: number): CalendarEvent | null {
  const startAt = fromUnits(segment, start, 'start');
  const endAt = fromUnits(segment, end, 'end');
  if (!startAt || !endAt || Temporal.ZonedDateTime.compare(endAt, startAt) <= 0) return null;
  return { id: crypto.randomUUID(), title: '', start: startAt, end: endAt, allDay: false };
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

type ZoneFace = { name: string; offset: string };

/** The short zone name and the offset `locale` writes at `at`. */
function zoneFace(timeZone: string, locale: string, at: Temporal.ZonedDateTime): ZoneFace {
  const read = (timeZoneName: 'short' | 'shortOffset') =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone, timeZoneName })
      .formatToParts(at.epochMilliseconds)
      .find((part) => part.type === 'timeZoneName')
      ?.value?.trim() || timeZone;
  return { name: read('short'), offset: read('shortOffset') };
}

/** The short zone name `locale` writes at `at`, such as PST in English or GMT-8 in Korean. */
export function zoneLabel(timeZone: string, locale: string, at: Temporal.ZonedDateTime): string {
  return zoneFace(timeZone, locale, at).name;
}

/** Every distinct face the visible hours take, in the order the days meet them. */
function zoneFaces(timeZone: string, locale: string, times: readonly Temporal.ZonedDateTime[]): ZoneFace[] {
  const faces: ZoneFace[] = [];
  for (const at of times) {
    const face = zoneFace(timeZone, locale, at);
    if (!faces.some((item) => item.name === face.name && item.offset === face.offset)) faces.push(face);
  }
  return faces;
}

function zoneSamples(segments: readonly DaySegment[]): Temporal.ZonedDateTime[] {
  const times = segments.flatMap((segment) => hourMarks(segment).map((mark) => mark.time));
  return times.length > 0 ? times : segments.map((segment) => segment.opens);
}

/** "PST / PDT" from the short names, in the order the week meets them. */
function zoneNames(faces: readonly ZoneFace[]): string {
  return faces.map((face) => face.name).join(' / ');
}

/** "PST / PDT (GMT-8 / GMT-7)", or just the offset when the short name already is one. */
function zonePhrase(faces: readonly ZoneFace[]): string {
  const names = zoneNames(faces);
  if (faces.every((face) => face.name === face.offset)) return names;
  return `${names} (${faces.map((face) => face.offset).join(' / ')})`;
}

function durationText(minutes: number, locale: string): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (locale.toLowerCase().startsWith('ko')) {
    if (hours > 0 && rest > 0) return `${hours}시간 ${rest}분`;
    return hours > 0 ? `${hours}시간` : `${rest}분`;
  }
  const parts = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (rest > 0) parts.push(`${rest} min`);
  return parts.join(' ');
}

/**
 * A sentence for the grid's description. The second column's lead is included only when
 * every visible hour has that same lead, so a midweek change is not described as one number.
 */
export function zoneDescription(timeZone: string, compareZone: string | null, locale: string, segments: readonly DaySegment[]): string {
  const samples = zoneSamples(segments);
  const ko = locale.toLowerCase().startsWith('ko');
  const primary = zonePhrase(zoneFaces(timeZone, locale, samples));
  const times = ko ? `시각은 ${primary}입니다.` : `Times in ${primary}.`;
  if (!compareZone) return times;
  const gaps = samples.map((at) => Math.round((at.withTimeZone(compareZone).offsetNanoseconds - at.offsetNanoseconds) / 60_000_000_000));
  const gap = gaps.length > 0 && gaps.every((value) => value === gaps[0]) ? gaps[0]! : null;
  const compare = zonePhrase(zoneFaces(compareZone, locale, samples));
  if (gap === null || gap === 0) return ko ? `${times} 둘째 열은 ${compare}입니다.` : `${times} Second column ${compare}.`;
  const duration = durationText(Math.abs(gap), locale);
  if (ko) return `${times} 둘째 열은 ${compare}이며, ${duration} ${gap > 0 ? '빠릅니다' : '느립니다'}.`;
  return `${times} Second column ${compare}, ${duration} ${gap > 0 ? 'ahead' : 'behind'}.`;
}

/** A signed day count in `locale`, such as "+1 day" or "+1일". Nothing when the dates match. */
export function dayShiftLabel(days: number, locale: string): string | null {
  if (days === 0) return null;
  const count = new Intl.NumberFormat(locale, { signDisplay: 'always', maximumFractionDigits: 0 }).format(days);
  const unit = new Intl.DisplayNames(locale, { type: 'dateTimeField', style: 'narrow' }).of('day') ?? 'day';
  const space = /\p{Script=Hangul}/u.test(unit) ? '' : ' ';
  return `${count}${space}${unit}`;
}

export type CompareMark = { units: number; time: Temporal.ZonedDateTime; dayShift: number };

/**
 * The other zone's time at a shared hour. The row is kept only when every visible column
 * has that same wall time and day shift. A time that is true for one day and wrong for
 * another is left out. It is not written inside the day column: that column's hour is the
 * grid zone, and a second time there would have no zone name beside it.
 */
export function compareMarks(segments: readonly DaySegment[], units: readonly number[], compareZone: string): CompareMark[] {
  return units.flatMap((at) => {
    const rows = segments.flatMap((segment) => {
      const time = fromUnits(segment, at, 'start');
      if (!time) return [];
      const there = time.withTimeZone(compareZone);
      return [{ time: there, dayShift: time.toPlainDate().until(there.toPlainDate(), { largestUnit: 'day' }).days }];
    });
    const first = rows[0];
    if (!first || rows.length !== segments.length) return [];
    const agreed = rows.every((row) => Temporal.PlainTime.compare(row.time.toPlainTime(), first.time.toPlainTime()) === 0 && row.dayShift === first.dayShift);
    return agreed ? [{ units: at, time: first.time, dayShift: first.dayShift }] : [];
  });
}

// Pinned so the page shows the same week whenever it opens.
const OPENS = Temporal.PlainTime.from('08:00');
const CLOSES = Temporal.PlainTime.from('18:00');
const ANCHOR = Temporal.PlainDate.from('2026-11-16');

const SAMPLE = [
  ['review', 'Design review', '2026-11-16', '09:00', '2026-11-16', '10:30', false],
  ['standup', 'Standup', '2026-11-16', '09:00', '2026-11-16', '09:30', false],
  ['handoff', 'Handoff', '2026-11-16', '17:00', '2026-11-17', '09:30', false],
  ['interview', 'Interview', '2026-11-17', '10:00', '2026-11-17', '11:00', false],
  ['early', 'Early sync', '2026-11-18', '07:00', '2026-11-18', '09:00', false],
  ['workshop', 'Workshop', '2026-11-18', '14:00', '2026-11-18', '16:30', false],
  ['planning', 'Planning', '2026-11-19', '10:00', '2026-11-19', '12:00', false],
  ['one', '1:1', '2026-11-19', '11:00', '2026-11-19', '11:30', false],
  ['crit', 'Crit', '2026-11-19', '11:00', '2026-11-19', '12:30', false],
  ['ship', 'Ship review', '2026-11-19', '15:00', '2026-11-19', '18:30', false],
  ['hiring', 'Hiring loop', '2026-11-19', '15:30', '2026-11-19', '16:30', false],
  ['sync', 'Staff sync', '2026-11-19', '16:00', '2026-11-19', '17:00', false],
  ['demo', 'Demo', '2026-11-20', '13:00', '2026-11-20', '14:00', false],
  ['offsite', 'Offsite', '2026-11-16', '00:00', '2026-11-17', '00:00', true],
  ['hours', 'Office hours', '2026-11-21', '11:00', '2026-11-21', '12:00', false],
  ['retreat', 'Retreat', '2026-11-20', '00:00', '2026-11-23', '00:00', true],
  ['launch', 'Launch watch', '2026-11-18', '22:00', '2026-11-19', '02:00', false],
] as const;

function sampleEvents(timeZone: string): CalendarEvent[] {
  return SAMPLE.map(([id, title, startDay, start, endDay, end, allDay]) => ({
    id,
    title,
    allDay,
    start: Temporal.PlainDateTime.from(`${startDay}T${start}`).toZonedDateTime(timeZone),
    end: Temporal.PlainDateTime.from(`${endDay}T${end}`).toZonedDateTime(timeZone),
  }));
}

type CalendarView = 'month' | 'week' | 'day';

type CreatePlace = { day: Temporal.PlainDate; start: number; end: number };

type EditorSession = { intent: 'edit'; event: CalendarEvent } | { intent: 'create'; event: CalendarEvent; place: CreatePlace };

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

/** A strip bar's grid lines. The gutters come first, and the end never passes the last day. */
function stripColumn(column: number, span: number, days: number, gutters: number): string {
  const start = column + gutters + 1;
  const end = Math.min(start + span, days + gutters + 1);
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
  if (event.allDay) return `${event.title}, ${range}`;
  const clock = (value: Temporal.ZonedDateTime) => formatTime(value.toPlainTime(), { locale });
  return `${event.title}, ${range}, ${clock(event.start.withTimeZone(timeZone))} to ${clock(event.end.withTimeZone(timeZone))}`;
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
  pendingCreate: { day: Temporal.PlainDate; start: number; end: number } | null;
  gutters: number;
};

function eventName(event: CalendarEvent, segment: DaySegment, locale: string, timeZone: string): { name: string; timeText: string; short: boolean } {
  const start = event.start.withTimeZone(timeZone);
  const end = event.end.withTimeZone(timeZone);
  const spansDays = !start.toPlainDate().equals(end.toPlainDate());
  const startLabel = clockLabel(start, locale, spansDays);
  const endLabel = clockLabel(end, locale, spansDays);
  const startedEarlier = Temporal.ZonedDateTime.compare(start, segment.opens) < 0;
  const continues = Temporal.ZonedDateTime.compare(end, segment.closes) > 0;
  const cue = [startedEarlier ? 'started earlier' : null, continues ? 'continues' : null].filter(Boolean).join(', ');
  const name = [`${event.title}, ${startLabel} to ${endLabel}`, cue].filter(Boolean).join(', ');
  const timeText = `${startedEarlier ? '…' : ''}${startLabel} to ${endLabel}${continues ? '…' : ''}`;
  const visible = clippedUnits(segment, event);
  const short = visible !== null && visible.end - visible.start < 45;
  return { name, timeText, short };
}

function EventMoves({ event, segment, axis, week, onAdjust, onEdit }: Pick<ColumnShared, 'axis' | 'week' | 'onAdjust' | 'onEdit'> & { event: CalendarEvent; segment: DaySegment }) {
  if (event.allDay) {
    return (
      <>
        <Menu.Item onSelect={() => onAdjust(event, segment, { kind: 'day', days: -1 })}>Move to previous day</Menu.Item>
        <Menu.Item onSelect={() => onAdjust(event, segment, { kind: 'day', days: 1 })}>Move to next day</Menu.Item>
        <Menu.Separator />
        <Menu.Item onSelect={() => onEdit(event, segment.day)}>Edit…</Menu.Item>
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
        </Menu.Trigger>
        <Menu.Content>
          <EventMoves event={span.event} segment={segment} axis={shared.axis} week={shared.week} onAdjust={shared.onAdjust} onEdit={shared.onEdit} />
        </Menu.Content>
      </Menu.Root>
      <span {...shared.lanes.getHandleProps(key, 'start')} aria-hidden className={styles.edge} data-edge="start" />
      <span {...shared.lanes.getHandleProps(key, 'end')} aria-hidden className={styles.edge} data-edge="end" />
    </li>
  );
}

const DragPreview = memo(function DragPreview({
  drag,
  segment,
  scale,
  locale,
  pending,
}: {
  drag: UseLaneDragResult['drag'];
  segment: DaySegment;
  scale: number;
  locale: string;
  pending: { start: number; end: number } | null;
}) {
  const change = useLaneDragState(drag, (state) => (state?.to?.lane === segment.day.toString() ? state : null));
  const live = change?.to ?? null;
  const place = live ?? pending;
  if (place == null || scale <= 0) return null;
  const creating = change?.kind === 'create' || (live == null && pending != null);
  const box = spanFrame({ start: place.start, end: place.end }, scale);
  const start = fromUnits(segment, place.start, 'start');
  const end = fromUnits(segment, place.end, 'end');
  const label = start && end ? `${formatTime(start.toPlainTime(), { locale })} to ${formatTime(end.toPlainTime(), { locale })}` : null;
  return (
    <div
      aria-hidden="true"
      className={styles.preview}
      data-create={creating ? '' : undefined}
      data-level={change?.verdict?.level}
      style={{ top: percent(box.top), height: percent(box.height) }}
    >
      {label ? <span className={styles.previewTime}>{label}</span> : null}
    </div>
  );
});

function StripBar({ bar, segment, shared }: { bar: DrawnBar; segment: DaySegment; shared: ColumnShared }) {
  const handoff = useFocusHandoff({ to: shared.landing });
  const key = stripKey(bar.event.id);
  return (
    <div ref={handoff} className={styles.stripSlot} style={{ gridColumn: stripColumn(bar.column, bar.span, shared.days, shared.gutters), gridRow: bar.row + 1 }}>
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
          {bar.cutEnd ? (
            <span aria-hidden="true" className={styles.cueEnd}>
              …
            </span>
          ) : null}
        </Menu.Trigger>
        <Menu.Content>
          <EventMoves event={bar.event} segment={segment} axis={shared.axis} week={shared.week} onAdjust={shared.onAdjust} onEdit={shared.onEdit} />
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
      <DragPreview
        drag={shared.lanes.drag}
        segment={segment}
        scale={shared.scale}
        locale={shared.locale}
        pending={shared.pendingCreate?.day.equals(segment.day) ? shared.pendingCreate : null}
      />
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

export function EventCalendarExample({
  locale = 'en-US',
  timeZone = Temporal.Now.timeZoneId(),
  compareZone,
  opens = OPENS,
  closes = CLOSES,
  anchor: initialAnchor = ANCHOR,
  events,
}: {
  locale?: string;
  /** IANA time zone the grid renders in. The viewer's zone when omitted. */
  timeZone?: string;
  /** A second IANA zone. Each primary hour then shows that zone's time. */
  compareZone?: string;
  opens?: Temporal.PlainTime;
  closes?: Temporal.PlainTime;
  anchor?: Temporal.PlainDate;
  events?: readonly CalendarEventInput[];
}) {
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(initialAnchor);
  const [items, setItems] = useState<CalendarEvent[]>(() => (events ?? sampleEvents(timeZone)).map((event) => projectEvent(event, timeZone)));
  const rootRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const timedBefore = useRef(new Map<string, { start: Temporal.PlainTime; end: Temporal.PlainTime; daySpan: number }>());
  const [session, setSession] = useState<EditorSession | null>(null);
  const notedDay = useRef(initialAnchor);
  const notedUnits = useRef(0);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const heading = useId();
  const descriptionId = useId();
  const pendingFocus = useRef<'day' | null>(null);
  const landing = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);
  const focusHeading = useRef<Temporal.PlainDate | null>(null);
  const [pinFocus, setPinFocus] = useState(true);
  const announce = useAnnouncer();
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
  const showCompare = compareZone !== undefined && compareZone !== timeZone && !narrow;
  const gutters = showCompare ? 2 : 1;
  const tracks = `${showCompare ? '4.5rem 6.5rem' : '4.5rem'} ${dayTracks}`;
  const stripBars = view === 'month' ? [] : barsOnBoard(items, week, timeZone, opens, closes, view === 'day' ? anchor : null);
  const minInline = `${lanes.reduce((sum, lane) => sum + Math.max(5.5, lane.columns * 4), showCompare ? 11 : 4.5)}rem`;
  const sharedMarks = sharedOffsets(axis.segments);
  const gutterMarks = scale > 0 ? [...sharedMarks].sort((a, b) => a - b) : [];
  const compared = showCompare && compareZone ? compareMarks(axis.segments, gutterMarks, compareZone) : [];
  const samples = zoneSamples(axis.segments);
  const primaryName = zoneNames(zoneFaces(timeZone, locale, samples));
  const compareName = showCompare && compareZone ? zoneNames(zoneFaces(compareZone, locale, samples)) : null;
  const description = zoneDescription(timeZone, compareName && compareZone ? compareZone : null, locale, axis.segments);
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
    setItems((list) => (list.some((each) => each.id === settled.id) ? list.map((each) => (each.id === settled.id ? settled : each)) : [...list, settled]));
    const start = settled.start.withTimeZone(timeZone);
    const end = settled.end.withTimeZone(timeZone);
    const spansDays = !start.toPlainDate().equals(end.toPlainDate());
    const detail = strip ? barLabel(settled, locale, timeZone) : `${settled.title}, ${clockLabel(start, locale, spansDays)} to ${clockLabel(end, locale, spansDays)}`;
    const created = !items.some((each) => each.id === settled.id);
    announce(created ? `Added ${detail}` : detail);
    returnFocus.current = true;
  };

  // The dialog unmounts in the same commit that records the edit, so its own
  // focus return has no button to land on yet. This runs after that commit.
  // The heading is consumed here. A value left from a cancelled create would
  // steal focus from a later cancelled edit.
  useLayoutEffect(() => {
    if (!returnFocus.current || session) return;
    returnFocus.current = false;
    const day = focusHeading.current;
    focusHeading.current = null;
    if (day) {
      document.getElementById(`${heading}-${day.toString()}`)?.focus();
      return;
    }
    if (landing.current?.isConnected) landing.current.focus();
  }, [anchor, session, focusKey, heading, items]);

  const beginCreate = (segment: DaySegment, start: number, end: number) => {
    const event = eventFromPlace(segment, start, end);
    if (!event) return;
    returnFocus.current = false;
    focusHeading.current = segment.day;
    setFocusKey(null);
    setSession({ intent: 'create', event, place: { day: segment.day, start, end } });
  };

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
    onCreate: (place) => {
      const segment = axis.segments.find((each) => each.day.toString() === place.lane);
      if (!segment) return;
      beginCreate(segment, place.start, place.end);
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
    setSession({ intent: 'edit', event });
  };

  const openNewEvent = () => {
    const noted = axis.segments.find((segment) => segment.day.equals(notedDay.current));
    const segment = noted ?? axis.segments.find((each) => each.day.equals(anchor)) ?? axis.segments[0];
    if (!segment || segment.length < SLOT_MINUTES) return;
    const start = noted && Number.isFinite(notedUnits.current) ? Math.min(Math.max(0, notedUnits.current), segment.length - SLOT_MINUTES) : 0;
    beginCreate(segment, start, start + SLOT_MINUTES);
  };

  const noteFocus = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const head = target.closest('h3');
    const prefix = `${heading}-`;
    if (head?.id.startsWith(prefix)) {
      notedDay.current = Temporal.PlainDate.from(head.id.slice(prefix.length));
      notedUnits.current = 0;
      return;
    }
    const lane = target.closest('[data-todae-lane]');
    const iso = lane?.getAttribute('data-todae-lane');
    if (!iso) return;
    notedDay.current = Temporal.PlainDate.from(iso);
    const end = target.closest('[data-todae-lane-item]')?.getAttribute('data-todae-lane-end');
    notedUnits.current = end ? Number(end) : 0;
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
    pendingCreate: session?.intent === 'create' ? session.place : null,
    gutters,
  };

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => {
      const width = el.getBoundingClientRect().width;
      setNarrow(width > 0 && Math.round(width) <= 375);
    };
    const watcher = new ResizeObserver(read);
    watcher.observe(el);
    read();
    return () => watcher.disconnect();
  }, []);

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
    <div ref={rootRef} className={styles.calendar} onFocusCapture={(event) => noteFocus(event.target)}>
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
        {view === 'month' ? null : (
          <>
            <Button.Root variant="secondary" onClick={openNewEvent}>
              New event
            </Button.Root>
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
        <ScrollArea.Root {...board.getBoardProps()} axis="both" focusable aria-label="Calendar" aria-describedby={descriptionId} className={styles.board}>
          <VisuallyHidden.Root id={descriptionId}>{description}</VisuallyHidden.Root>
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
              <div className={styles.corner}>
                <Text.Root as="span" variant="label" tone="muted" className={styles.zone}>
                  {primaryName}
                </Text.Root>
              </div>
              {compareName ? (
                <div className={styles.corner}>
                  <Text.Root as="span" variant="label" tone="muted" className={styles.zone}>
                    {compareName}
                  </Text.Root>
                </div>
              ) : null}
              {axis.segments.map((segment) => (
                <Text.Root as="h3" variant="label" tabIndex={-1} id={`${heading}-${segment.day.toString()}`} key={segment.day.toString()} className={styles.day}>
                  {dayHeading(segment.day, locale)}
                </Text.Root>
              ))}
            </div>
            {stripBars.length === 0 ? null : (
              <div className={styles.strip}>
                {Array.from({ length: gutters }, (_, index) => (
                  <div key={index} className={styles.corner} />
                ))}
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
              {showCompare ? (
                // The hours repeat the primary instants, and only where every day agrees. The description names this zone, so the column stays quiet.
                <div className={styles.gutter} aria-hidden="true" data-compare="">
                  {compared.map((mark) => {
                    const shift = dayShiftLabel(mark.dayShift, locale);
                    return (
                      <Text.Root
                        as="span"
                        key={mark.units}
                        variant="label"
                        tone="muted"
                        className={styles.mark}
                        data-first={mark.units === 0 ? '' : undefined}
                        style={{ top: percent(mark.units / scale) }}
                      >
                        {formatTime(mark.time.toPlainTime(), { locale })}
                        {shift ? ` ${shift}` : ''}
                      </Text.Root>
                    );
                  })}
                </div>
              ) : null}
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
      {session ? (
        <EventEditor
          event={session.event}
          intent={session.intent}
          locale={locale}
          timeZone={timeZone}
          opens={opens}
          prior={timedBefore.current.get(session.event.id) ?? null}
          restoreFocusRef={landing}
          onCancel={() => {
            returnFocus.current = true;
            setSession(null);
          }}
          onSave={(next) => {
            const day = next.start.withTimeZone(timeZone).toPlainDate();
            const home = shownDay(next, day);
            setAnchor(home ?? day);
            commit(next, home ?? day);
            setSession(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Edits one event, or fills in a new one. `onSave` receives the event the fields name.
 */
export function EventEditor({
  event,
  intent = 'edit',
  locale,
  timeZone,
  opens = OPENS,
  prior = null,
  onSave,
  onCancel,
  restoreFocusRef,
}: {
  event: CalendarEvent;
  intent?: 'edit' | 'create';
  locale: string;
  timeZone: string;
  opens?: Temporal.PlainTime;
  prior?: { start: Temporal.PlainTime; end: Temporal.PlainTime; daySpan: number } | null;
  onSave: (event: CalendarEvent) => void;
  onCancel: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ids = { title: useId(), date: useId(), endDate: useId(), start: useId(), end: useId(), dialog: useId() };
  const titleRef = useRef<HTMLInputElement>(null);
  const remembered = useRef<{ start: Temporal.PlainTime | null; end: Temporal.PlainTime | null; endDate?: Temporal.PlainDate | null; daySpan?: number } | null>(prior);
  const [fields, setFields] = useState<EventDraft>(() => {
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
  });
  const [errors, setErrors] = useState<FormErrors>({});
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

  const submit = (submitEvent: SubmitEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const result = eventFromDraft(fields, timeZone);
    if (!result.ok) {
      setErrors({ [result.issue.field]: result.issue.message });
      return;
    }
    onSave({ ...event, ...result.value });
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()} initialFocusRef={titleRef} restoreFocusRef={restoreFocusRef}>
      <Form.Root errors={errors} onSubmit={submit} aria-labelledby={ids.dialog} className={styles.fields}>
        <Dialog.Header>
          <Dialog.Title id={ids.dialog}>{intent === 'create' ? 'New event' : `Edit ${event.title}`}</Dialog.Title>
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
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close>Cancel</Dialog.Close>
          <Button.Root type="submit">Save</Button.Root>
        </Dialog.Footer>
      </Form.Root>
    </Dialog.Root>
  );
}

/** The page. Pacific time, with India Standard Time in the second column. */
export default function EventCalendarZones({ locale = 'en-US' }: { locale?: string }) {
  return <EventCalendarExample locale={locale} timeZone="America/Los_Angeles" compareZone="Asia/Kolkata" />;
}
