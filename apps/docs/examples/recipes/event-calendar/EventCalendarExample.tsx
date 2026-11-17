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
  timed('handoff', 'Handoff', '2026-11-16', '17:00', '2026-11-17', '09:30'),
  timed('interview', 'Interview', '2026-11-17', '10:00', '2026-11-17', '11:00'),
  timed('early', 'Early sync', '2026-11-18', '07:00', '2026-11-18', '09:00'),
  timed('workshop', 'Workshop', '2026-11-18', '14:00', '2026-11-18', '16:30'),
  timed('one', '1:1', '2026-11-19', '11:00', '2026-11-19', '11:30'),
  timed('ship', 'Ship review', '2026-11-19', '15:00', '2026-11-19', '18:30'),
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
  return `${start} to ${end}`;
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 1e6) / 1e4}%`;
}

function EventColumn({
  segment,
  spans,
  scale,
  locale,
  headingId,
}: {
  segment: DaySegment;
  spans: readonly VisibleSpan[];
  scale: number;
  locale: string;
  headingId: string;
}) {
  const placed = spans.filter((span) => span.day.equals(segment.day)).sort((a, b) => a.start - b.start || a.event.title.localeCompare(b.event.title));
  return (
    <div className={styles.column}>
      <ol className={styles.events} aria-labelledby={headingId}>
        {placed.map((span) => {
          const starts = fromUnits(segment, span.start, 'start');
          const ends = fromUnits(segment, span.end, 'end');
          if (!starts || !ends) return null;
          const startLabel = formatTime(starts.toPlainTime(), { locale });
          const endLabel = formatTime(ends.toPlainTime(), { locale });
          const box = spanFrame(span, scale);
          return (
            <li key={`${span.event.id}-${segment.day.toString()}`} className={styles.slot} style={{ top: percent(box.top), height: percent(box.height) }}>
              <Button.Root variant="ghost" className={styles.event} aria-label={`${span.event.title}, ${startLabel} to ${endLabel}`} tooltip={false}>
                <Text.Root as="span" weight="medium" lines={1}>
                  {span.event.title}
                </Text.Root>
                <Text.Root as="span" variant="label" tone="muted" lines={1}>
                  {startLabel} to {endLabel}
                </Text.Root>
              </Button.Root>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function EventCalendarExample({ locale = 'en-US' }: { locale?: string }) {
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(ANCHOR);
  const heading = useId();
  const days = view === 'week' ? weekOf(anchor) : [anchor];
  const axis = daySegments({ days, opens: OPENS, closes: CLOSES, timeZone: ZONE });
  const scale = laneScale(axis);
  const spans = visibleSpans(axis, EVENTS);
  const gutter = axis.segments.find((segment) => segment.length === scale);
  const marks = gutter && scale > 0 ? hourMarks(gutter) : [];
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
              {marks.map((mark, index) => (
                <Text.Root
                  as="span"
                  key={mark.units}
                  variant="label"
                  tone="muted"
                  className={styles.mark}
                  data-first={index === 0 ? '' : undefined}
                  style={{ top: percent(mark.units / scale) }}
                >
                  {formatTime(mark.time.toPlainTime(), { locale })}
                </Text.Root>
              ))}
            </div>
            {axis.segments.map((segment) => (
              <EventColumn key={segment.day.toString()} segment={segment} spans={spans} scale={scale} locale={locale} headingId={`${heading}-${segment.day.toString()}`} />
            ))}
          </div>
        </div>
      </ScrollArea.Root>
    </div>
  );
}
