// Each day is its own lane down the page. Units are elapsed minutes from that
// day's opening, so a clock change makes the lane as long as the day really is.
// A wall time the change skips or repeats follows Temporal's `compatible`.

export type CalendarEvent = {
  id: string;
  seriesId?: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  allDay: boolean;
};

/** One day's visible hours, `length` minutes long in real time. */
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
 * A segment per day, open from `opens` to `closes` in `timeZone`. PlainTime has no
 * 24:00, so a close at or before the open is that time on the next day.
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
  return {
    segments: days.map((day) => {
      const open = zoned(day, opens, timeZone);
      const sameDay = zoned(day, closes, timeZone);
      const close = Temporal.ZonedDateTime.compare(sameDay, open) > 0 ? sameDay : zoned(day.add({ days: 1 }), closes, timeZone);
      return { day, opens: open, closes: close, length: minutesBetween(open, close) };
    }),
  };
}

// The close of one day and the open of the next can be one instant. A start
// belongs to the later day, and an end to the earlier one.
function holds(length: number, units: number, edge: Edge): boolean {
  return edge === 'start' ? units >= 0 && units < length : units > 0 && units <= length;
}

/** The lane `at` belongs to, or null when it falls outside every visible day. */
export function toUnits(axis: DayAxis, at: Temporal.ZonedDateTime, edge: Edge = 'start'): DayPosition | null {
  for (const segment of axis.segments) {
    const units = minutesBetween(segment.opens, at);
    if (holds(segment.length, units, edge)) return { day: segment.day, units };
  }
  return null;
}

/** The time `units` minutes into `segment`, or null outside that lane. */
export function fromUnits(segment: DaySegment, units: number, edge: Edge = 'start'): Temporal.ZonedDateTime | null {
  if (!holds(segment.length, units, edge)) return null;
  return segment.opens.add({ minutes: units });
}

/** Every `step` minutes from the opening, and the closing even when it falls off the step. */
export function snapGrid(segment: DaySegment, step: number): number[] {
  const points = new Set<number>();
  for (let units = 0; units < segment.length; units += step) points.add(units);
  points.add(segment.length);
  return [...points].sort((a, b) => a - b);
}

/**
 * Occurrences whose time overlaps `event`, other than `event` itself. The
 * interval is half-open, so touching at an endpoint is not an overlap.
 * `allDay` and `seriesId` do not change that.
 */
export function findConflicts(event: CalendarEvent, others: readonly CalendarEvent[]): { id: string }[] {
  return others.flatMap((other) =>
    other.id !== event.id &&
    Temporal.ZonedDateTime.compare(other.start, event.end) < 0 &&
    Temporal.ZonedDateTime.compare(event.start, other.end) < 0
      ? [{ id: other.id }]
      : [],
  );
}
