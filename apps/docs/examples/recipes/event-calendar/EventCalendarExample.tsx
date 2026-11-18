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

export type DraftIssue = { field: 'title' | 'date' | 'start' | 'end'; message: string };

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
    const start = draft.date.toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from('00:00') });
    const end = draft.date.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from('00:00') });
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
      const start = event.start.withTimeZone(timeZone);
      const end = event.end.withTimeZone(timeZone);
      return Temporal.ZonedDateTime.compare(start, closes) < 0 && Temporal.ZonedDateTime.compare(end, opens) > 0;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      const byStart = Temporal.ZonedDateTime.compare(a.start.withTimeZone(timeZone), b.start.withTimeZone(timeZone));
      if (byStart !== 0) return byStart;
      return a.title.localeCompare(b.title, locale);
    });
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
];

type CalendarView = 'month' | 'week' | 'day';

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

function parseBlockKey(key: string): { id: string; day: string } {
  const at = key.lastIndexOf('@');
  return { id: key.slice(0, at), day: key.slice(at + 1) };
}

type ColumnShared = {
  locale: string;
  timeZone: string;
  scale: number;
  axis: DayAxis;
  week: boolean;
  lanes: UseLaneDragResult;
  landing: RefObject<HTMLButtonElement | null>;
  focusKey: string | null;
  onAdjust: (event: CalendarEvent, segment: DaySegment, change: SlotChange) => void;
  onEdit: (event: CalendarEvent, day: Temporal.PlainDate) => void;
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
  const [items, setItems] = useState<CalendarEvent[]>(() => events.map((event) => ({ ...event })));
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const heading = useId();
  const pendingFocus = useRef<'day' | null>(null);
  const landing = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);
  const focusHeading = useRef<Temporal.PlainDate | null>(null);
  const [pinFocus, setPinFocus] = useState(true);
  const announce = useAnnouncer();
  const days = view === 'week' ? weekOf(anchor, locale) : [anchor];
  const axis = daySegments({ days, opens, closes, timeZone });
  const scale = laneScale(axis);
  const spans = visibleSpans(axis, items);
  const lanes = axis.segments.map((segment) => {
    const placed = placeOverlaps(daySpans(spans, segment.day, locale));
    const columns = placed.reduce((count, place) => Math.max(count, place.columns), 1);
    return { segment, placed, columns };
  });
  const tracks = `4.5rem ${lanes.map((lane) => dayTrack(lane.columns)).join(' ')}`;
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

  const commit = (next: CalendarEvent, day: Temporal.PlainDate, where: 'event' | 'heading' = 'event') => {
    const current = items.find((each) => each.id === next.id) ?? next;
    const settled = finishGesture(current, next, 'drop');
    const onLane = where === 'event' && !settled.allDay;
    setFocusKey(onLane ? blockKey(settled.id, day) : null);
    focusHeading.current = onLane ? null : day;
    setItems((list) => list.map((each) => (each.id === settled.id ? settled : each)));
    const start = settled.start.withTimeZone(timeZone);
    const end = settled.end.withTimeZone(timeZone);
    const spansDays = !start.toPlainDate().equals(end.toPlainDate());
    announce(`${settled.title}, ${clockLabel(start, locale, spansDays)} to ${clockLabel(end, locale, spansDays)}`);
    returnFocus.current = true;
  };

  // The dialog unmounts in the same commit that records the edit, so its own
  // focus return has no button to land on yet. This runs after that commit.
  useLayoutEffect(() => {
    if (!returnFocus.current || editing) return;
    returnFocus.current = false;
    const day = focusHeading.current;
    if (day) {
      document.getElementById(`${heading}-${day.toString()}`)?.focus();
      return;
    }
    if (landing.current?.isConnected) landing.current.focus();
  }, [anchor, editing, focusKey, heading, items]);

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
    const next = adjustEvent(event, segment, axis, change);
    if (!next) return;
    const day = change.kind === 'day' ? segment.day.add({ days: change.days }) : segment.day;
    commit(next, day);
  };

  const onEdit = (event: CalendarEvent, day: Temporal.PlainDate) => {
    setFocusKey(blockKey(event.id, day));
    setEditing(event);
  };

  const columnShared: ColumnShared = {
    locale,
    timeZone,
    scale,
    axis,
    week: view === 'week',
    lanes: board,
    landing,
    focusKey,
    onAdjust,
    onEdit,
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
            renderDay={(day) => {
              const list = eventsOnDay(day.date, items, timeZone, locale);
              const shown = list.slice(0, MONTH_TITLES);
              const extra = list.length - shown.length;
              return (
                <span className={styles.chips} data-date={day.date.toString()}>
                  {day.date.day === 1 && !day.outside ? <SyncTabStop onDay={keepAnchor} /> : null}
                  {list.length === 0 ? null : (
                    <>
                      <span className={styles.detail}>
                        {shown.map((event, index) => (
                          <span key={event.id} className={styles.chip}>
                            {index > 0 ? <VisuallyHidden.Root>, </VisuallyHidden.Root> : null}
                            {event.title}
                          </span>
                        ))}
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
                  )}
                </span>
              );
            }}
          />
        </Calendar.Root>
      ) : (
        <ScrollArea.Root {...board.getBoardProps()} axis="both" focusable aria-label="Calendar" className={styles.board}>
          <div
            className={styles.frame}
            style={{ ['--days' as string]: days.length, ['--minutes' as string]: scale, ['--min-inline' as string]: minInline, ['--tracks' as string]: tracks }}
          >
            <div className={styles.head}>
              <div className={styles.corner} />
              {axis.segments.map((segment) => (
                <Text.Root as="h3" variant="label" tabIndex={-1} id={`${heading}-${segment.day.toString()}`} key={segment.day.toString()} className={styles.day}>
                  {dayHeading(segment.day, locale)}
                </Text.Root>
              ))}
            </div>
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
          event={editing}
          locale={locale}
          timeZone={timeZone}
          restoreFocusRef={landing}
          onCancel={() => {
            returnFocus.current = true;
            setEditing(null);
          }}
          onSave={(next) => {
            const day = next.start.withTimeZone(timeZone).toPlainDate();
            const home = shownDay(next, day);
            setAnchor(home ?? day);
            commit(next, home ?? day, home ? 'event' : 'heading');
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Edits one event's title and time. Drag-to-create can open it with the event
 * a drag sketched and read the saved event from `onSave`.
 */
export function EventEditor({
  event,
  locale,
  timeZone,
  onSave,
  onCancel,
  restoreFocusRef,
}: {
  event: CalendarEvent;
  locale: string;
  timeZone: string;
  onSave: (event: CalendarEvent) => void;
  onCancel: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ids = { title: useId(), date: useId(), endDate: useId(), start: useId(), end: useId(), dialog: useId() };
  const titleRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<EventDraft>(() => {
    const start = event.start.withTimeZone(timeZone);
    const end = event.end.withTimeZone(timeZone);
    return { title: event.title, date: start.toPlainDate(), endDate: end.toPlainDate(), start: start.toPlainTime(), end: end.toPlainTime(), allDay: event.allDay };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const edit =
    <K extends keyof EventDraft>(key: K) =>
    (value: EventDraft[K]) => {
      setErrors({});
      setFields((current) => shiftDraft(current, key, value, timeZone));
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
          <Dialog.Title id={ids.dialog}>{`Edit ${event.title}`}</Dialog.Title>
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
          <Switch.Root className={styles.allDay} checked={fields.allDay} onCheckedChange={edit('allDay')}>
            All day
          </Switch.Root>
          {fields.allDay ? null : (
            <>
              <Field.Group>
                <Label.Root htmlFor={ids.start}>Start</Label.Root>
                <Field.Root id={ids.start} name="start">
                  <Field.TimeInput required value={fields.start} onValueChange={edit('start')} locale={locale} />
                </Field.Root>
                <ErrorMessage.Root />
              </Field.Group>
              <Field.Group>
                <Label.Root htmlFor={ids.endDate}>End date</Label.Root>
                <Field.Root id={ids.endDate} name="endDate">
                  <Field.DateInput required value={fields.endDate} onValueChange={edit('endDate')} locale={locale} />
                </Field.Root>
                <ErrorMessage.Root />
              </Field.Group>
              <Field.Group>
                <Label.Root htmlFor={ids.end}>End</Label.Root>
                <Field.Root id={ids.end} name="end">
                  <Field.TimeInput required value={fields.end} onValueChange={edit('end')} locale={locale} />
                </Field.Root>
                <ErrorMessage.Root />
              </Field.Group>
            </>
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
