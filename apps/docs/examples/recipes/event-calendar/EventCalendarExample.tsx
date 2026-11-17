'use client';

import { Button, ScrollArea, Text, ToggleGroup, formatTime } from '@tounsoo/todae';
import { useId, useState } from 'react';
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

export function findConflicts(event: CalendarEvent, others: readonly CalendarEvent[]): { id: string }[] {
  return others.flatMap((other) =>
    other.id !== event.id &&
    Temporal.ZonedDateTime.compare(other.start, event.end) < 0 &&
    Temporal.ZonedDateTime.compare(event.start, other.end) < 0
      ? [{ id: other.id }]
      : [],
  );
}

export function weekOf(day: Temporal.PlainDate): Temporal.PlainDate[] {
  const monday = day.subtract({ days: day.dayOfWeek - 1 });
  return Array.from({ length: 7 }, (_, index) => monday.add({ days: index }));
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
};

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

// Spans that overlap in a chain share one column count. Each takes the first
// column free at its start, then widens into columns on its right that stay
// free while it runs. Touching at an endpoint is not an overlap.
export function placeOverlaps<T extends { start: number; end: number }>(items: readonly T[]): OverlapPlacement<T>[] {
  const order = items.map((item, index) => ({ item, index }));
  order.sort((a, b) => a.item.start - b.item.start || a.item.end - b.item.end || a.index - b.index);

  const placed = new Map<number, { left: number; width: number }>();
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
      if (columns > 0) placed.set(entry.index, { left: entry.column / columns, width: span / columns });
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
    return { item, left: box.left, width: box.width };
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

type CalendarView = 'week' | 'day';

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

function EventColumn({
  segment,
  spans,
  scale,
  locale,
  timeZone,
  headingId,
  shared,
}: {
  segment: DaySegment;
  spans: readonly VisibleSpan[];
  scale: number;
  locale: string;
  timeZone: string;
  headingId: string;
  shared: ReadonlySet<number>;
}) {
  const placed = placeOverlaps(
    spans
      .filter((span) => span.day.equals(segment.day))
      .sort((a, b) => a.start - b.start || a.end - b.end || a.event.title.localeCompare(b.event.title, locale)),
  );
  const marks = scale > 0 ? hourMarks(segment) : [];
  return (
    <div className={styles.column}>
      <div className={styles.hours} aria-hidden="true">
        {marks.map((mark) => {
          const top = percent(mark.units / scale);
          const agreed = shared.has(mark.units);
          return (
            <div key={mark.units}>
              <div className={styles.line} style={{ top }} />
              {agreed ? null : (
                <Text.Root as="span" variant="label" tone="muted" className={styles.columnMark} data-first={mark.units === 0 ? '' : undefined} style={{ top }}>
                  {formatTime(mark.time.toPlainTime(), { locale })}
                </Text.Root>
              )}
            </div>
          );
        })}
      </div>
      <ol className={styles.events} aria-labelledby={headingId}>
        {placed.map(({ item: span, left, width }) => {
          const start = span.event.start.withTimeZone(timeZone);
          const end = span.event.end.withTimeZone(timeZone);
          const spansDays = !start.toPlainDate().equals(end.toPlainDate());
          const startLabel = clockLabel(start, locale, spansDays);
          const endLabel = clockLabel(end, locale, spansDays);
          const startedEarlier = Temporal.ZonedDateTime.compare(start, segment.opens) < 0;
          const continues = Temporal.ZonedDateTime.compare(end, segment.closes) > 0;
          const cue = [startedEarlier ? 'started earlier' : null, continues ? 'continues' : null].filter(Boolean).join(', ');
          const name = [`${span.event.title}, ${startLabel} to ${endLabel}`, cue].filter(Boolean).join(', ');
          const timeText = `${startedEarlier ? '…' : ''}${startLabel} to ${endLabel}${continues ? '…' : ''}`;
          const box = spanFrame(span, scale);
          const short = span.end - span.start < 45;
          return (
            <li
              key={`${span.event.id}-${segment.day.toString()}`}
              className={styles.slot}
              style={{ top: percent(box.top), height: percent(box.height), insetInlineStart: percent(left), inlineSize: percent(width) }}
            >
              <Button.Root variant="ghost" className={styles.event} aria-label={name} tooltip={false}>
                <Text.Root as="span" weight="medium" lines={1}>
                  {span.event.title}
                </Text.Root>
                {short ? null : (
                  <Text.Root as="span" variant="label" tone="muted" lines={1}>
                    {timeText}
                  </Text.Root>
                )}
              </Button.Root>
            </li>
          );
        })}
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
  const heading = useId();
  const days = view === 'week' ? weekOf(anchor) : [anchor];
  const axis = daySegments({ days, opens, closes, timeZone });
  const scale = laneScale(axis);
  const spans = visibleSpans(axis, events);
  const shared = sharedOffsets(axis.segments);
  const gutterMarks = scale > 0 ? [...shared].sort((a, b) => a - b) : [];
  const step = view === 'week' ? 7 : 1;

  return (
    <div className={styles.calendar}>
      <div className={styles.toolbar}>
        <ToggleGroup.Root
          aria-label="Calendar view"
          value={view}
          onValueChange={(value) => {
            if (value === 'week' || value === 'day') setView(value);
          }}
        >
          <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
          <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Button.Root variant="secondary" onClick={() => setAnchor((day) => day.add({ days: -step }))}>
          {view === 'week' ? 'Previous week' : 'Previous day'}
        </Button.Root>
        <Button.Root variant="secondary" onClick={() => setAnchor((day) => day.add({ days: step }))}>
          {view === 'week' ? 'Next week' : 'Next day'}
        </Button.Root>
        <Text.Root className={styles.range}>{rangeLabel(days, locale)}</Text.Root>
      </div>
      <ScrollArea.Root axis="both" focusable aria-label="Calendar" className={styles.board}>
        <div
          className={styles.frame}
          style={{ ['--days' as string]: days.length, ['--minutes' as string]: scale }}
        >
          <div className={styles.head}>
            <div />
            {axis.segments.map((segment) => (
              <Text.Root as="h3" variant="label" id={`${heading}-${segment.day.toString()}`} key={segment.day.toString()} className={styles.day}>
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
            {axis.segments.map((segment) => (
              <EventColumn
                key={segment.day.toString()}
                segment={segment}
                spans={spans}
                scale={scale}
                locale={locale}
                timeZone={timeZone}
                headingId={`${heading}-${segment.day.toString()}`}
                shared={shared}
              />
            ))}
          </div>
        </div>
      </ScrollArea.Root>
    </div>
  );
}
