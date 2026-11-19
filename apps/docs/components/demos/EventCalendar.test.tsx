// @vitest-environment jsdom
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatTime } from '@tounsoo/todae';
import EventCalendarZones, {
  EventCalendarExample,
  EventEditor,
  SLOT_MINUTES,
  adjustEvent,
  clampSpan,
  daySegments,
  eventFromDraft,
  eventFromLane,
  shiftDraft,
  findConflicts,
  finishGesture,
  fromUnits,
  hourMarks,
  laneScale,
  placeOverlaps,
  snapGrid,
  snapToSlot,
  spanFrame,
  toUnits,
  packWeekBars,
  eventsOnDay,
  showsInStrip,
  visibleSpans,
  weekOf,
  type CalendarEvent,
  type DaySegment,
} from '../../examples/recipes/event-calendar/EventCalendarExample';

const date = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);
const at = (text: string) => Temporal.ZonedDateTime.from(text);

const LA = 'America/Los_Angeles';
const SPRING = date('2027-03-14');
const FALL = date('2027-11-07');

function longDate(iso: string, locale = 'en-US'): string {
  const day = date(iso);
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(day.year, day.month - 1, day.day));
}

function longRange(start: string, end: string, locale = 'en-US'): string {
  return `${longDate(start, locale)} – ${longDate(end, locale)}`;
}

function event(id: string, start: string, end: string, extra: Partial<Pick<CalendarEvent, 'seriesId' | 'allDay' | 'title'>> = {}): CalendarEvent {
  return { id, title: id, start: at(start), end: at(end), allDay: false, ...extra };
}

function lane(axis: ReturnType<typeof daySegments>, day: string): DaySegment {
  const segment = axis.segments.find((each) => each.day.toString() === day);
  if (!segment) throw new Error(`no segment for ${day}`);
  return segment;
}

describe('day lanes', () => {
  const zone = LA;
  const days = [date('2027-06-02'), date('2027-06-03')];

  it('gives each visible day its own lane of real minutes, and leaves the night off the lane', () => {
    const axis = daySegments({ days, opens: time('08:00'), closes: time('18:00'), timeZone: zone });
    expect(axis.segments.map(({ day, length }) => [day.toString(), length])).toEqual([
      ['2027-06-02', 600],
      ['2027-06-03', 600],
    ]);
    expect(toUnits(axis, at('2027-06-02T10:15:00-07:00[America/Los_Angeles]'))).toEqual({ day: date('2027-06-02'), units: 135 });
    expect(toUnits(axis, at('2027-06-02T20:00:00-07:00[America/Los_Angeles]'))).toBeNull();
    expect(fromUnits(lane(axis, '2027-06-02'), 135)!.toString()).toBe('2027-06-02T10:15:00-07:00[America/Los_Angeles]');
  });

  it('puts a shared midnight on the later day as a start and the earlier day as an end', () => {
    const axis = daySegments({ days, opens: time('00:00'), closes: time('00:00'), timeZone: zone });
    const midnight = at('2027-06-03T00:00:00-07:00[America/Los_Angeles]');
    expect(toUnits(axis, midnight, 'start')).toEqual({ day: date('2027-06-03'), units: 0 });
    expect(toUnits(axis, midnight, 'end')).toEqual({ day: date('2027-06-02'), units: 1440 });
    expect(fromUnits(lane(axis, '2027-06-03'), 0, 'start')!.toString()).toBe(midnight.toString());
    expect(fromUnits(lane(axis, '2027-06-02'), 1440, 'end')!.toString()).toBe(midnight.toString());
    expect(fromUnits(lane(axis, '2027-06-03'), 0, 'end')).toBeNull();
    expect(fromUnits(lane(axis, '2027-06-02'), 1440, 'start')).toBeNull();
    expect(toUnits(axis, at('2027-06-02T00:00:00-07:00[America/Los_Angeles]'), 'end')).toBeNull();
  });

  it('keeps a visible-hour close and the next open as two instants on two lanes', () => {
    const axis = daySegments({ days, opens: time('08:00'), closes: time('18:00'), timeZone: zone });
    const close = at('2027-06-02T18:00:00-07:00[America/Los_Angeles]');
    const open = at('2027-06-03T08:00:00-07:00[America/Los_Angeles]');
    expect(toUnits(axis, close, 'end')).toEqual({ day: date('2027-06-02'), units: 600 });
    expect(toUnits(axis, close, 'start')).toBeNull();
    expect(toUnits(axis, open, 'start')).toEqual({ day: date('2027-06-03'), units: 0 });
    expect(toUnits(axis, open, 'end')).toBeNull();
    expect(Temporal.ZonedDateTime.compare(close, open)).not.toBe(0);
  });

  it('snaps to each step from the opening, and to the closing when the step misses it', () => {
    const axis = daySegments({ days: [date('2027-06-02')], opens: time('08:00'), closes: time('18:00'), timeZone: zone });
    expect(snapGrid(lane(axis, '2027-06-02'), 240)).toEqual([0, 240, 480, 600]);
    expect(snapGrid(lane(axis, '2027-06-02'), 1000)).toEqual([0, 600]);
    expect(() => snapGrid(lane(axis, '2027-06-02'), 0)).toThrow(RangeError);
    expect(() => snapGrid(lane(axis, '2027-06-02'), -30)).toThrow(RangeError);
  });
});

describe('clock changes', () => {
  it('makes a spring-forward day its real length and lands past the skipped hour', () => {
    const full = daySegments({ days: [SPRING], opens: time('00:00'), closes: time('00:00'), timeZone: LA });
    expect(lane(full, '2027-03-14').length).toBe(23 * 60);
    const night = daySegments({ days: [SPRING], opens: time('00:00'), closes: time('04:00'), timeZone: LA });
    const segment = lane(night, '2027-03-14');
    expect(segment.length).toBe(180);
    expect(toUnits(night, at('2027-03-14T03:00:00-07:00[America/Los_Angeles]'))).toEqual({ day: SPRING, units: 120 });
    expect(fromUnits(segment, 120)!.toString()).toBe('2027-03-14T03:00:00-07:00[America/Los_Angeles]');
    expect(fromUnits(segment, 180, 'end')!.toString()).toBe('2027-03-14T04:00:00-07:00[America/Los_Angeles]');
  });

  it('makes a fall-back day its real length and keeps both times in the repeated hour', () => {
    const full = daySegments({ days: [FALL], opens: time('00:00'), closes: time('00:00'), timeZone: LA });
    expect(lane(full, '2027-11-07').length).toBe(25 * 60);
    const night = daySegments({ days: [FALL], opens: time('00:00'), closes: time('04:00'), timeZone: LA });
    const segment = lane(night, '2027-11-07');
    expect(segment.length).toBe(300);
    const first = at('2027-11-07T01:00:00-07:00[America/Los_Angeles]');
    const second = at('2027-11-07T01:00:00-08:00[America/Los_Angeles]');
    expect(toUnits(night, first)).toEqual({ day: FALL, units: 60 });
    expect(toUnits(night, second)).toEqual({ day: FALL, units: 120 });
    expect(fromUnits(segment, 60)!.toString()).toBe(first.toString());
    expect(fromUnits(segment, 120)!.toString()).toBe(second.toString());
    expect(snapGrid(segment, 90)).toEqual([0, 90, 180, 270, 300]);
  });

  it.each([
    ['02:00', '03:00'],
    ['02:30', '03:00'],
  ])('keeps %s to %s inside the spring-forward gap as an empty lane', (opens, closes) => {
    const axis = daySegments({ days: [SPRING], opens: time(opens), closes: time(closes), timeZone: LA });
    const segment = lane(axis, '2027-03-14');
    expect(segment.length).toBe(0);
    expect(Temporal.ZonedDateTime.compare(segment.closes, segment.opens)).toBe(0);
    expect(toUnits(axis, segment.opens, 'start')).toBeNull();
  });

  it('resolves a skipped or repeated wall time the way Temporal compatible does', () => {
    const skipped = daySegments({ days: [SPRING], opens: time('02:30'), closes: time('04:00'), timeZone: LA });
    expect(lane(skipped, '2027-03-14').opens.toString()).toBe('2027-03-14T03:30:00-07:00[America/Los_Angeles]');
    expect(lane(skipped, '2027-03-14').length).toBe(30);
    const repeated = daySegments({ days: [FALL], opens: time('01:30'), closes: time('04:00'), timeZone: LA });
    expect(lane(repeated, '2027-11-07').opens.toString()).toBe('2027-11-07T01:30:00-07:00[America/Los_Angeles]');
  });
});

describe('a zone other than the runner', () => {
  it('keeps a half-hour offset that is not the process zone', () => {
    const zone = 'Asia/Kathmandu';
    expect(zone).not.toBe(Temporal.Now.timeZoneId());
    const axis = daySegments({ days: [date('2027-06-02')], opens: time('09:00'), closes: time('10:00'), timeZone: zone });
    const segment = lane(axis, '2027-06-02');
    expect(segment.opens.toString()).toBe('2027-06-02T09:00:00+05:45[Asia/Kathmandu]');
    expect(segment.length).toBe(60);
    expect(toUnits(axis, at('2027-06-02T09:30:00+05:45[Asia/Kathmandu]'))).toEqual({ day: date('2027-06-02'), units: 30 });
    expect(fromUnits(segment, 30)!.toString()).toBe('2027-06-02T09:30:00+05:45[Asia/Kathmandu]');
  });
});

describe('findConflicts', () => {
  const talk = event('a', '2027-06-02T10:00:00-07:00[America/Los_Angeles]', '2027-06-02T11:00:00-07:00[America/Los_Angeles]', { seriesId: 'series-1' });

  it('lists an occurrence that overlaps, including one from the same series, and skips itself', () => {
    const overlaps = findConflicts(talk, [
      event('b', '2027-06-02T10:30:00-07:00[America/Los_Angeles]', '2027-06-02T11:30:00-07:00[America/Los_Angeles]'),
      event('c', '2027-06-02T10:15:00-07:00[America/Los_Angeles]', '2027-06-02T10:45:00-07:00[America/Los_Angeles]', { seriesId: 'series-1' }),
      event('d', '2027-06-02T12:00:00-07:00[America/Los_Angeles]', '2027-06-02T13:00:00-07:00[America/Los_Angeles]', { seriesId: 'series-1' }),
      event('a', '2027-06-02T10:00:00-07:00[America/Los_Angeles]', '2027-06-02T11:00:00-07:00[America/Los_Angeles]'),
    ]);
    expect(overlaps).toEqual([{ id: 'b' }, { id: 'c' }]);
  });

  it('does not treat ends that only touch as an overlap', () => {
    const touching = [
      event('before', '2027-06-02T09:00:00-07:00[America/Los_Angeles]', '2027-06-02T10:00:00-07:00[America/Los_Angeles]'),
      event('after', '2027-06-02T11:00:00-07:00[America/Los_Angeles]', '2027-06-02T12:00:00-07:00[America/Los_Angeles]'),
    ];
    expect(findConflicts(talk, touching)).toEqual([]);
  });

  it('overlaps by instant across zones, and an all-day flag does not add or remove one', () => {
    const tokyo = event('tokyo', '2027-06-03T02:00:00+09:00[Asia/Tokyo]', '2027-06-03T03:30:00+09:00[Asia/Tokyo]');
    expect(findConflicts(talk, [tokyo])).toEqual([{ id: 'tokyo' }]);
    const day = event('day', '2027-06-02T00:00:00-07:00[America/Los_Angeles]', '2027-06-03T00:00:00-07:00[America/Los_Angeles]', { allDay: true });
    const next = event('next', '2027-06-03T00:00:00-07:00[America/Los_Angeles]', '2027-06-04T00:00:00-07:00[America/Los_Angeles]', { allDay: true });
    expect(findConflicts(talk, [day, next])).toEqual([{ id: 'day' }]);
    expect(findConflicts(talk, [{ ...day, allDay: false }])).toEqual([{ id: 'day' }]);
  });
});

function placed(items: { id: string; start: number; end: number }[]) {
  return placeOverlaps(items).map(({ item, left, width }) => [item.id, left, width]);
}

describe('placeOverlaps', () => {
  it('gives spans that do not overlap the full width, and keeps the order it was given', () => {
    expect(placed([
      { id: 'later', start: 120, end: 180 },
      { id: 'early', start: 0, end: 60 },
    ])).toEqual([
      ['later', 0, 1],
      ['early', 0, 1],
    ]);
  });

  it('shares one column count across a chain, so the ends sit in the column the middle leaves free', () => {
    expect(placed([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 },
      { id: 'c', start: 60, end: 120 },
    ])).toEqual([
      ['a', 0, 0.5],
      ['b', 0.5, 0.5],
      ['c', 0, 0.5],
    ]);
  });

  it('puts spans with the same start and end side by side', () => {
    expect(placed([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 0, end: 60 },
      { id: 'c', start: 0, end: 60 },
    ])).toEqual([
      ['a', 0, 1 / 3],
      ['b', 1 / 3, 1 / 3],
      ['c', 2 / 3, 1 / 3],
    ]);
  });

  it('puts a span that sits inside another beside it', () => {
    expect(placed([
      { id: 'outer', start: 0, end: 120 },
      { id: 'inner', start: 30, end: 60 },
    ])).toEqual([
      ['outer', 0, 0.5],
      ['inner', 0.5, 0.5],
    ]);
  });

  it('does not treat spans that only touch as overlapping', () => {
    expect(placed([
      { id: 'before', start: 0, end: 60 },
      { id: 'after', start: 60, end: 120 },
    ])).toEqual([
      ['before', 0, 1],
      ['after', 0, 1],
    ]);
  });

  it('packs a zero-length span with the span that contains its instant, and not with another at the same instant', () => {
    expect(placed([
      { id: 'long', start: 0, end: 60 },
      { id: 'point', start: 30, end: 30 },
    ])).toEqual([
      ['long', 0, 0.5],
      ['point', 0.5, 0.5],
    ]);
    expect(placed([
      { id: 'a', start: 30, end: 30 },
      { id: 'b', start: 30, end: 30 },
    ])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
    expect(placed([{ id: 'only', start: 15, end: 15 }])).toEqual([['only', 0, 1]]);
    expect(placed([
      { id: 'point', start: 0, end: 0 },
      { id: 'long', start: 0, end: 60 },
    ])).toEqual([
      ['point', 0, 1],
      ['long', 0, 1],
    ]);
  });

  it('keeps a zero-length span out of a column when a longer span starts with it', () => {
    const boxes = (items: { id: string; start: number; end: number }[]) =>
      placeOverlaps(items).map(({ left, width, columns }) => [left, width, columns]);
    expect(boxes([
      { id: 'long', start: 0, end: 30 },
      { id: 'point', start: 0, end: 0 },
    ])).toEqual([
      [0, 1, 1],
      [0, 1, 1],
    ]);
    expect(boxes([
      { id: 'a', start: 0, end: 30 },
      { id: 'point', start: 0, end: 0 },
      { id: 'b', start: 0, end: 30 },
    ])).toEqual([
      [0, 0.5, 2],
      [0, 1, 1],
      [0.5, 0.5, 2],
    ]);
    expect(boxes([
      { id: 'long', start: 0, end: 30 },
      { id: 'point', start: 15, end: 15 },
    ])).toEqual([
      [0, 0.5, 2],
      [0.5, 0.5, 2],
    ]);
  });

  it('widens a span into a column that only touches it, and not through a busy column', () => {
    expect(placed([
      { id: 'a', start: 0, end: 30 },
      { id: 'b', start: 0, end: 30 },
      { id: 'c', start: 0, end: 90 },
      { id: 'd', start: 30, end: 60 },
    ])).toEqual([
      ['a', 1 / 3, 1 / 3],
      ['b', 2 / 3, 1 / 3],
      ['c', 0, 1 / 3],
      ['d', 1 / 3, 2 / 3],
    ]);
    expect(placed([
      { id: 'x', start: 0, end: 30 },
      { id: 'y', start: 0, end: 90 },
      { id: 'z', start: 10, end: 20 },
      { id: 'w', start: 30, end: 60 },
    ])).toEqual([
      ['x', 1 / 3, 1 / 3],
      ['y', 0, 1 / 3],
      ['z', 2 / 3, 1 / 3],
      ['w', 1 / 3, 2 / 3],
    ]);
    expect(placed([
      { id: 'a', start: 0, end: 20 },
      { id: 'b', start: 10, end: 20 },
      { id: 'c', start: 10, end: 30 },
      { id: 'd', start: 20, end: 30 },
    ])).toEqual([
      ['a', 0, 1 / 3],
      ['b', 2 / 3, 1 / 3],
      ['c', 1 / 3, 1 / 3],
      ['d', 0, 1 / 3],
    ]);
  });

  it('starts a new cluster when a span begins as the previous one ends, and gives that cluster its own column count', () => {
    const boundary = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 0, end: 60 },
      { id: 'c', start: 60, end: 120 },
    ];
    expect(placed(boundary)).toEqual([
      ['a', 0, 0.5],
      ['b', 0.5, 0.5],
      ['c', 0, 1],
    ]);
    expect(placeOverlaps(boundary).map((place) => place.columns)).toEqual([2, 2, 1]);
    const apart = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 0, end: 60 },
      { id: 'c', start: 120, end: 180 },
    ];
    expect(placed(apart)).toEqual([
      ['a', 0, 0.5],
      ['b', 0.5, 0.5],
      ['c', 0, 1],
    ]);
    expect(placeOverlaps(apart).map((place) => place.columns)).toEqual([2, 2, 1]);
  });

  it('widens a span into columns on its right that stay free while it runs', () => {
    expect(placed([
      { id: 'b', start: 0, end: 20 },
      { id: 'a', start: 0, end: 30 },
      { id: 'c', start: 10, end: 100 },
      { id: 'd', start: 40, end: 100 },
    ])).toEqual([
      ['b', 1 / 3, 1 / 3],
      ['a', 0, 1 / 3],
      ['c', 2 / 3, 1 / 3],
      ['d', 0, 2 / 3],
    ]);
  });

  it('packs a fall-back lane by elapsed minutes, so the two 1:00 hours share a column only when the instants overlap', () => {
    const axis = daySegments({ days: [FALL], opens: time('00:00'), closes: time('04:00'), timeZone: LA });
    const spans = visibleSpans(axis, [
      event('early', '2027-11-07T01:00:00-07:00[America/Los_Angeles]', '2027-11-07T01:30:00-07:00[America/Los_Angeles]'),
      event('first', '2027-11-07T01:00:00-08:00[America/Los_Angeles]', '2027-11-07T01:30:00-08:00[America/Los_Angeles]'),
      event('second', '2027-11-07T01:15:00-08:00[America/Los_Angeles]', '2027-11-07T01:45:00-08:00[America/Los_Angeles]'),
    ]);
    expect(placeOverlaps(spans).map(({ item, left, width }) => [item.event.id, item.start, item.end, left, width])).toEqual([
      ['early', 60, 90, 0, 1],
      ['first', 120, 150, 0, 0.5],
      ['second', 135, 165, 0.5, 0.5],
    ]);
  });
});

describe('placing events on the lanes', () => {
  const zone = LA;
  const days = [date('2027-06-02'), date('2027-06-03')];
  const axis = daySegments({ days, opens: time('08:00'), closes: time('18:00'), timeZone: zone });

  it('clips an event to the visible hours and drops one that only touches an endpoint', () => {
    const spans = visibleSpans(axis, [
      event('early', '2027-06-02T07:00:00-07:00[America/Los_Angeles]', '2027-06-02T09:00:00-07:00[America/Los_Angeles]'),
      event('inside', '2027-06-02T09:00:00-07:00[America/Los_Angeles]', '2027-06-02T10:30:00-07:00[America/Los_Angeles]'),
      event('touch', '2027-06-02T18:00:00-07:00[America/Los_Angeles]', '2027-06-02T19:00:00-07:00[America/Los_Angeles]'),
      event('night', '2027-06-02T19:00:00-07:00[America/Los_Angeles]', '2027-06-02T20:00:00-07:00[America/Los_Angeles]'),
      event('day', '2027-06-02T00:00:00-07:00[America/Los_Angeles]', '2027-06-03T00:00:00-07:00[America/Los_Angeles]', { allDay: true }),
    ]);
    expect(spans.map(({ event: item, day, start, end }) => [item.id, day.toString(), start, end])).toEqual([
      ['early', '2027-06-02', 0, 60],
      ['inside', '2027-06-02', 60, 150],
    ]);
  });

  it('splits an event that runs past the close into the next visible day', () => {
    const spans = visibleSpans(axis, [event('handoff', '2027-06-02T17:00:00-07:00[America/Los_Angeles]', '2027-06-03T09:30:00-07:00[America/Los_Angeles]')]);
    expect(spans.map(({ day, start, end }) => [day.toString(), start, end])).toEqual([
      ['2027-06-02', 540, 600],
      ['2027-06-03', 0, 90],
    ]);
    expect(spanFrame(spans[0]!, laneScale(axis))).toEqual({ top: 540 / 600, height: 60 / 600 });
    expect(spanFrame(spans[1]!, laneScale(axis))).toEqual({ top: 0, height: 90 / 600 });
  });

  it('gives an empty spring-forward lane no spans, and lists each hour before the close', () => {
    const gap = daySegments({ days: [SPRING], opens: time('02:00'), closes: time('03:00'), timeZone: LA });
    const empty = lane(gap, '2027-03-14');
    expect(laneScale(gap)).toBe(0);
    expect(visibleSpans(gap, [{ id: 'gone', title: 'gone', start: empty.opens, end: empty.closes, allDay: false }])).toEqual([]);
    expect(() => spanFrame({ start: 0, end: 30 }, 0)).toThrow(RangeError);
    const segment = lane(axis, '2027-06-02');
    expect(hourMarks(segment).map(({ units, time: mark }) => [units, mark.toString()])).toEqual([
      [0, '2027-06-02T08:00:00-07:00[America/Los_Angeles]'],
      [60, '2027-06-02T09:00:00-07:00[America/Los_Angeles]'],
      [120, '2027-06-02T10:00:00-07:00[America/Los_Angeles]'],
      [180, '2027-06-02T11:00:00-07:00[America/Los_Angeles]'],
      [240, '2027-06-02T12:00:00-07:00[America/Los_Angeles]'],
      [300, '2027-06-02T13:00:00-07:00[America/Los_Angeles]'],
      [360, '2027-06-02T14:00:00-07:00[America/Los_Angeles]'],
      [420, '2027-06-02T15:00:00-07:00[America/Los_Angeles]'],
      [480, '2027-06-02T16:00:00-07:00[America/Los_Angeles]'],
      [540, '2027-06-02T17:00:00-07:00[America/Los_Angeles]'],
    ]);
  });

  it('starts the week on the locale’s first day', () => {
    expect(weekOf(date('2026-11-17'), 'en-US').map((day) => day.toString())).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);
    expect(weekOf(date('2026-11-15'), 'ko-KR')[0]?.toString()).toBe('2026-11-15');
    expect(weekOf(date('2026-11-15'), 'de-DE')[0]?.toString()).toBe('2026-11-09');
  });
});

function clock(text: string): string {
  return formatTime(time(text), { locale: 'en-US' });
}

describe('the calendar', () => {
  afterEach(cleanup);

  it('shows seven day columns in the week, and one column on the day, with each event named and placed', () => {
    render(<EventCalendarExample locale="en-US" />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    const standup = screen.getByRole('button', { name: `Standup, ${clock('09:00')} to ${clock('09:30')}` });
    expect(review.parentElement?.style.top).toBe('10%');
    expect(review.parentElement?.style.height).toBe('15%');
    expect(standup.parentElement?.style.insetInlineStart).toBe('50%');
    expect(standup.parentElement?.style.inlineSize).toBe('50%');
    expect(review.parentElement?.style.insetInlineStart).toBe('0%');
    expect(review.parentElement?.style.inlineSize).toBe('50%');
    expect(review.compareDocumentPosition(standup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    review.focus();
    expect(document.activeElement).toBe(review);
    const handoff = `Handoff, Mon, Nov 16, ${clock('17:00')} to Tue, Nov 17, ${clock('09:30')}`;
    expect(screen.getByRole('button', { name: `${handoff}, continues` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `${handoff}, started earlier` })).toBeTruthy();
    const early = screen.getByRole('button', { name: `Early sync, ${clock('07:00')} to ${clock('09:00')}, started earlier` });
    expect(early.parentElement?.style.top).toBe('0%');
    expect(early.parentElement?.style.height).toBe('10%');
    expect(early.textContent).toContain('…');
    expect(screen.getByRole('button', { name: `Ship review, ${clock('15:00')} to ${clock('18:30')}, continues` })).toBeTruthy();
    const one = screen.getByRole('button', { name: `1:1, ${clock('11:00')} to ${clock('11:30')}` });
    expect(one.textContent).toBe('1:1');
    const offsite = screen.getByRole('button', { name: `Offsite, ${longDate('2026-11-16')}` });
    expect(screen.getByRole('list', { name: 'Mon, Nov 16' }).contains(offsite)).toBe(false);
    expect(screen.getByRole('button', { name: `Launch watch, ${longRange('2026-11-18', '2026-11-19')}, ${clock('22:00')} to ${clock('02:00')}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: `Handoff, ${longRange('2026-11-16', '2026-11-17')}` })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Interview/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Design review/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('button', { name: /Interview/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Design review/ })).toBeNull();
    expect(screen.getByRole('button', { name: `Handoff, Mon, Nov 16, ${clock('17:00')} to Tue, Nov 17, ${clock('09:30')}, started earlier` })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.queryByRole('button', { name: /Design review/ })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
  });

  it('names a strip bar with the title and the full date range in Korean', () => {
    render(<EventCalendarExample locale="ko" />);
    expect(screen.getByRole('button', { name: `Retreat, ${longRange('2026-11-20', '2026-11-22', 'ko')}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Offsite, ${longDate('2026-11-16', 'ko')}` })).toBeTruthy();
  });

  it('keeps a fall-back week’s hours on the day they belong to', () => {
    const zone = 'America/Los_Angeles';
    const monday = Temporal.PlainDate.from('2026-11-02');
    render(
      <EventCalendarExample
        locale="en-US"
        timeZone={zone}
        opens={Temporal.PlainTime.from('00:00')}
        closes={Temporal.PlainTime.from('06:00')}
        anchor={monday}
        events={[
          {
            id: 'three',
            title: 'Night check',
            start: Temporal.PlainDateTime.from('2026-11-02T03:00').toZonedDateTime(zone),
            end: Temporal.PlainDateTime.from('2026-11-02T03:30').toZonedDateTime(zone),
            allDay: false,
          },
        ]}
      />,
    );

    const mondayColumn = screen.getByRole('list', { name: 'Mon, Nov 2' }).parentElement;
    const three = [...(mondayColumn?.querySelectorAll('span') ?? [])].find((node) => node.textContent === '3:00 AM');
    const event = screen.getByRole('button', { name: /Night check/ });
    expect(three).toBeTruthy();
    expect(event.parentElement?.style.top).toBe((three as HTMLElement).style.top);

    const board = event.closest('[aria-label="Calendar"]');
    const oneAm = [...(board?.querySelectorAll('span') ?? [])].filter((node) => node.textContent === '1:00 AM');
    expect(oneAm).toHaveLength(2);
    const sundayColumn = screen.getByRole('list', { name: 'Sun, Nov 1 · PST begins' }).parentElement;
    const sundayOne = [...(sundayColumn?.querySelectorAll('span') ?? [])].filter((node) => node.textContent === '1:00 AM');
    expect(sundayOne).toHaveLength(1);

    const lines = (column: Element | null) =>
      [...(column?.querySelectorAll<HTMLElement>('[style*="top"]') ?? [])].filter((node) => (node.textContent ?? '').trim() === '');
    expect(lines(mondayColumn)).toHaveLength(6);
    expect(lines(sundayColumn)).toHaveLength(7);
    expect(lines(mondayColumn).some((line) => line.style.top === event.parentElement?.style.top)).toBe(true);

    const gutter = mondayColumn?.parentElement?.firstElementChild;
    const gutterLabels = [...(gutter?.querySelectorAll('span') ?? [])];
    for (const label of gutterLabels) {
      const columns = [...(gutter?.parentElement?.children ?? [])].slice(1);
      for (const column of columns) {
        const sameRow = [...column.querySelectorAll('span')].filter((node) => (node as HTMLElement).style.top === (label as HTMLElement).style.top && node.textContent?.trim());
        expect(sameRow.every((node) => node.textContent === label.textContent)).toBe(true);
      }
    }
  });

  it('lists Month, then Week, then Day', () => {
    render(<EventCalendarExample locale="en-US" />);
    const month = screen.getByRole('button', { name: 'Month' });
    const week = screen.getByRole('button', { name: 'Week' });
    const day = screen.getByRole('button', { name: 'Day' });
    expect(month.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(week.compareDocumentPosition(day) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names a week in the page locale with one dash', () => {
    render(<EventCalendarExample locale="en-US" />);
    expect(screen.getByText('Nov 15 – Nov 21, 2026')).toBeTruthy();
    cleanup();
    render(<EventCalendarExample locale="ko-KR" />);
    expect(screen.getByText('11월 15일 – 2026년 11월 21일')).toBeTruthy();
  });

  it('names an event in the calendar zone and places it on that day', () => {
    render(
      <EventCalendarExample
        locale="en-US"
        timeZone={LA}
        events={[
          {
            id: 'tokyo',
            title: 'Tokyo',
            start: Temporal.ZonedDateTime.from('2026-11-17T02:00:00+09:00[Asia/Tokyo]'),
            end: Temporal.ZonedDateTime.from('2026-11-17T03:00:00+09:00[Asia/Tokyo]'),
            allDay: false,
          },
        ]}
      />,
    );
    const event = screen.getByRole('button', { name: `Tokyo, ${clock('09:00')} to ${clock('10:00')}` });
    const monday = screen.getByRole('list', { name: 'Mon, Nov 16' });
    expect(monday.contains(event)).toBe(true);
    const gutter = monday.parentElement?.parentElement?.firstElementChild;
    const nine = [...(gutter?.querySelectorAll('span') ?? [])].find((node) => node.textContent === clock('09:00'));
    expect(nine).toBeTruthy();
    expect(event.parentElement?.style.top).toBe((nine as HTMLElement).style.top);
  });

  it('shows Thursday’s overlapping events side by side, in start order', () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    const planning = screen.getByRole('button', { name: `Planning, ${clock('10:00')} to ${clock('12:00')}` });
    const one = screen.getByRole('button', { name: `1:1, ${clock('11:00')} to ${clock('11:30')}` });
    const crit = screen.getByRole('button', { name: `Crit, ${clock('11:00')} to ${clock('12:30')}` });
    expect(planning.parentElement?.style.insetInlineStart).toBe('0%');
    expect(planning.parentElement?.style.inlineSize).toBe('33.3333%');
    expect(crit.parentElement?.style.insetInlineStart).toBe('33.3333%');
    expect(crit.parentElement?.style.inlineSize).toBe('33.3333%');
    expect(one.parentElement?.style.insetInlineStart).toBe('66.6667%');
    expect(one.parentElement?.style.inlineSize).toBe('33.3333%');
    expect(planning.compareDocumentPosition(crit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(crit.compareDocumentPosition(one) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    planning.focus();
    expect(document.activeElement).toBe(planning);
    one.focus();
    expect(document.activeElement).toBe(one);
    crit.focus();
    expect(document.activeElement).toBe(crit);
  });

  it('gives Thursday a track for three columns and keeps a single event at 5.5rem', () => {
    render(<EventCalendarExample locale="en-US" />);
    const head = screen.getByRole('heading', { name: 'Thu, Nov 19' }).parentElement as HTMLElement;
    const body = head.nextElementSibling as HTMLElement;
    const frame = head.parentElement as HTMLElement;
    const tracks = frame.style.getPropertyValue('--tracks').match(/minmax\(max\(5\.5rem, \d+ \* 4rem\), 1fr\)/g);
    expect(tracks).toEqual([
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 2 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 3 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
    ]);
    expect(head.style.gridTemplateColumns).toBe('');
    expect(body.style.gridTemplateColumns).toBe('');
  });

  it('puts overlapping events side by side and keeps their names in start order', () => {
    const zone = 'America/Los_Angeles';
    const zoned = (clockText: string) => Temporal.PlainDateTime.from(`2026-11-19T${clockText}`).toZonedDateTime(zone);
    render(
      <EventCalendarExample
        locale="en-US"
        timeZone={zone}
        anchor={date('2026-11-19')}
        events={[
          { id: 'alpha', title: 'Alpha', start: zoned('10:00'), end: zoned('11:00'), allDay: false },
          {
            id: 'tokyo',
            title: 'Tokyo',
            start: Temporal.ZonedDateTime.from('2026-11-20T03:30:00+09:00[Asia/Tokyo]'),
            end: Temporal.ZonedDateTime.from('2026-11-20T04:30:00+09:00[Asia/Tokyo]'),
            allDay: false,
          },
          { id: 'demo', title: 'Demo', start: zoned('13:00'), end: zoned('14:00'), allDay: false },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));

    const alpha = screen.getByRole('button', { name: `Alpha, ${clock('10:00')} to ${clock('11:00')}` });
    const tokyo = screen.getByRole('button', { name: `Tokyo, ${clock('10:30')} to ${clock('11:30')}` });
    const demo = screen.getByRole('button', { name: `Demo, ${clock('13:00')} to ${clock('14:00')}` });
    const list = screen.getByRole('list', { name: 'Thu, Nov 19' });
    expect(list.contains(alpha)).toBe(true);
    expect(list.contains(tokyo)).toBe(true);
    expect(list.contains(demo)).toBe(true);
    expect(alpha.compareDocumentPosition(tokyo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tokyo.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alpha.parentElement?.style.insetInlineStart).toBe('0%');
    expect(alpha.parentElement?.style.inlineSize).toBe('50%');
    expect(tokyo.parentElement?.style.insetInlineStart).toBe('50%');
    expect(tokyo.parentElement?.style.inlineSize).toBe('50%');
    expect(demo.parentElement?.style.insetInlineStart).toBe('0%');
    expect(demo.parentElement?.style.inlineSize).toBe('100%');
    alpha.focus();
    expect(document.activeElement).toBe(alpha);
    tokyo.focus();
    expect(document.activeElement).toBe(tokyo);
    demo.focus();
    expect(document.activeElement).toBe(demo);
  });

  it('places the repeated hour side by side and leaves the earlier 1:00 at its own row', () => {
    render(
      <EventCalendarExample
        locale="en-US"
        timeZone={LA}
        opens={time('00:00')}
        closes={time('04:00')}
        anchor={FALL}
        events={[
          {
            id: 'early',
            title: 'Early',
            start: at('2027-11-07T01:00:00-07:00[America/Los_Angeles]'),
            end: at('2027-11-07T01:30:00-07:00[America/Los_Angeles]'),
            allDay: false,
          },
          {
            id: 'first',
            title: 'First',
            start: at('2027-11-07T01:00:00-08:00[America/Los_Angeles]'),
            end: at('2027-11-07T01:30:00-08:00[America/Los_Angeles]'),
            allDay: false,
          },
          {
            id: 'second',
            title: 'Second',
            start: at('2027-11-07T01:15:00-08:00[America/Los_Angeles]'),
            end: at('2027-11-07T01:45:00-08:00[America/Los_Angeles]'),
            allDay: false,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));

    const early = screen.getByRole('button', { name: `Early, ${clock('01:00')} to ${clock('01:30')}` });
    const first = screen.getByRole('button', { name: `First, ${clock('01:00')} to ${clock('01:30')}` });
    const second = screen.getByRole('button', { name: `Second, ${clock('01:15')} to ${clock('01:45')}` });
    expect(early.parentElement?.style.top).toBe('20%');
    expect(early.parentElement?.style.inlineSize).toBe('100%');
    expect(first.parentElement?.style.top).toBe('40%');
    expect(first.parentElement?.style.insetInlineStart).toBe('0%');
    expect(first.parentElement?.style.inlineSize).toBe('50%');
    expect(second.parentElement?.style.top).toBe('45%');
    expect(second.parentElement?.style.insetInlineStart).toBe('50%');
    expect(second.parentElement?.style.inlineSize).toBe('50%');
    expect(early.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    early.focus();
    expect(document.activeElement).toBe(early);
    second.focus();
    expect(document.activeElement).toBe(second);
  });
});

function describedBy(name: string): string | null {
  const button = screen.getByRole('button', { name });
  const id = button.getAttribute('aria-describedby');
  if (!id) return null;
  const node = document.getElementById(id);
  if (!node) return null;
  const text = spokenText(node);
  return text.length === 0 ? '' : text;
}

function spokenText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true') return '';
  return [...node.childNodes].map((child) => spokenText(child)).join('');
}

describe('packWeekBars', () => {
  const week = weekOf(date('2026-11-16'), 'en-US');
  const next = weekOf(date('2026-11-22'), 'en-US');
  const span = (id: string, start: string, end: string, allDay = false) => event(id, start, end, { allDay, title: id });

  it('gives an earlier start the earlier row, and the longer span the earlier row when the starts match', () => {
    const early = span('early', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-18T00:00:00-08:00[America/Los_Angeles]', true);
    const later = span('later', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', '2026-11-20T00:00:00-08:00[America/Los_Angeles]', true);
    const placed = packWeekBars([later, early], week, LA);
    expect(placed.find((item) => item.event.id === 'early')).toMatchObject({ row: 0, column: 1, span: 2, continuesFrom: false, continuesTo: false });
    expect(placed.find((item) => item.event.id === 'later')).toMatchObject({ row: 1, column: 2, span: 3 });

    const long = span('long', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-19T00:00:00-08:00[America/Los_Angeles]', true);
    const short = span('short', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', true);
    const ties = packWeekBars([short, long], week, LA);
    expect(ties.find((item) => item.event.id === 'long')).toMatchObject({ row: 0, span: 3 });
    expect(ties.find((item) => item.event.id === 'short')).toMatchObject({ row: 1, span: 1 });
  });

  it('shares a row when bars meet at a day boundary, and stacks bars that share a day', () => {
    const monday = span('monday', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', true);
    const tuesday = span('tuesday', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', '2026-11-18T00:00:00-08:00[America/Los_Angeles]', true);
    expect(packWeekBars([monday, tuesday], week, LA).map((item) => item.row)).toEqual([0, 0]);

    const overlap = span('overlap', '2026-11-16T12:00:00-08:00[America/Los_Angeles]', '2026-11-17T12:00:00-08:00[America/Los_Angeles]');
    const stacked = packWeekBars([monday, overlap], week, LA);
    expect(stacked.find((item) => item.event.id === 'monday')?.row).toBe(0);
    expect(stacked.find((item) => item.event.id === 'overlap')?.row).toBe(1);
  });

  it('splits a bar on the week boundary and flags each cut', () => {
    const retreat = span('retreat', '2026-11-20T00:00:00-08:00[America/Los_Angeles]', '2026-11-23T00:00:00-08:00[America/Los_Angeles]', true);
    expect(packWeekBars([retreat], week, LA)[0]).toMatchObject({ column: 5, span: 2, row: 0, continuesFrom: false, continuesTo: true });
    expect(packWeekBars([retreat], next, LA)[0]).toMatchObject({ column: 0, span: 1, row: 0, continuesFrom: true, continuesTo: false });
  });

  it('leaves a single-day timed event unpacked, including one that ends at the next midnight', () => {
    const talk = span('talk', '2026-11-16T09:00:00-08:00[America/Los_Angeles]', '2026-11-16T10:00:00-08:00[America/Los_Angeles]');
    const untilMidnight = span('until', '2026-11-16T10:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]');
    expect(packWeekBars([talk, untilMidnight], week, LA)).toEqual([]);
    const day = span('day', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', true);
    expect(packWeekBars([day], week, LA)[0]).toMatchObject({ column: 1, span: 1, continuesFrom: false, continuesTo: false });
  });

  it('keeps an overnight event that misses the open hours off the lanes', () => {
    const launch = span('launch', '2026-11-18T22:00:00-08:00[America/Los_Angeles]', '2026-11-19T02:00:00-08:00[America/Los_Angeles]');
    const handoff = span('handoff', '2026-11-16T17:00:00-08:00[America/Los_Angeles]', '2026-11-17T09:30:00-08:00[America/Los_Angeles]');
    expect(showsInStrip(launch, LA, time('08:00'), time('18:00'))).toBe(true);
    expect(showsInStrip(handoff, LA, time('08:00'), time('18:00'))).toBe(false);
    expect(packWeekBars([launch], week, LA)[0]).toMatchObject({ column: 3, span: 2, continuesFrom: false, continuesTo: false });
  });

  it('keeps an all-day event on the date in its own zone', () => {
    const tokyo = span('tokyo', '2026-11-18T00:00:00+09:00[Asia/Tokyo]', '2026-11-19T00:00:00+09:00[Asia/Tokyo]', true);
    expect(packWeekBars([tokyo], week, LA)[0]).toMatchObject({ column: 3, span: 1, continuesFrom: false, continuesTo: false });
    expect(eventsOnDay(date('2026-11-18'), [tokyo], LA, 'en-US').map((item) => item.id)).toEqual(['tokyo']);
    expect(eventsOnDay(date('2026-11-17'), [tokyo], LA, 'en-US')).toEqual([]);
  });
});

describe('the month', () => {
  afterEach(cleanup);

  function openMonth(locale = 'en-US') {
    render(<EventCalendarExample locale={locale} />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
  }

  it('describes each day with two titles and the count of the rest, and draws the trailing days', () => {
    openMonth();
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Monday, November 16, 2026' }).getAttribute('aria-label')).toBe('Monday, November 16, 2026');
    expect(describedBy('Monday, November 16, 2026')).toBe(`Offsite, ${longDate('2026-11-16')}, Handoff, ${longRange('2026-11-16', '2026-11-17')}, +2 more`);
    expect(describedBy('Tuesday, November 17, 2026')).toBe(`Handoff, ${longRange('2026-11-16', '2026-11-17')}, Interview`);
    expect(describedBy('Wednesday, November 18, 2026')).toBe(`Launch watch, ${longRange('2026-11-18', '2026-11-19')}, Early sync, +1 more`);
    expect(describedBy('Thursday, November 19, 2026')).toBe(`Launch watch, ${longRange('2026-11-18', '2026-11-19')}, Planning, +5 more`);
    expect(describedBy('Friday, November 20, 2026')).toBe(`Retreat, ${longRange('2026-11-20', '2026-11-22')}, Demo`);
    expect(describedBy('Saturday, November 21, 2026')).toBe(`Retreat, ${longRange('2026-11-20', '2026-11-22')}, Office hours`);
    const saturday = screen.getByRole('button', { name: 'Saturday, November 21, 2026' });
    expect(saturday.querySelectorAll('[class*="cue"]')).toHaveLength(1);
    expect(saturday.querySelector('[data-bar="retreat"]')?.hasAttribute('data-cut-start')).toBe(false);
    expect(screen.getByRole('button', { name: 'Friday, November 20, 2026' }).querySelectorAll('[class*="cue"]')).toHaveLength(0);
    expect(describedBy('Sunday, November 15, 2026')).toBe('Book club, repeats');
    const anchorDay = screen.getByRole('button', { name: 'Monday, November 16, 2026' });
    expect(anchorDay.hasAttribute('data-selected')).toBe(false);
    expect(anchorDay.closest('td')?.getAttribute('aria-selected')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tuesday, December 1, 2026' })).toBeTruthy();
  });

  it('reads the upper bar first when a lower row is listed earlier', () => {
    const low = event('low', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', '2026-11-18T00:00:00-08:00[America/Los_Angeles]', { title: 'Low', allDay: true });
    const high = event('high', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-19T00:00:00-08:00[America/Los_Angeles]', { title: 'High', allDay: true });
    render(<EventCalendarExample locale="en-US" events={[low, high]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Tuesday, November 17, 2026')).toBe(`High, ${longRange('2026-11-16', '2026-11-18')}, Low, ${longDate('2026-11-17')}`);
  });

  it('puts a multi-day event on each day it covers, and keeps an event that ends at midnight on the earlier day', () => {
    const zone = 'America/Los_Angeles';
    const events = [
      event('span', '2026-11-16T17:00:00-08:00[America/Los_Angeles]', '2026-11-18T09:00:00-08:00[America/Los_Angeles]', { title: 'Span' }),
      event('edge', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', { title: 'Edge', allDay: true }),
    ];
    render(<EventCalendarExample locale="en-US" timeZone={zone} events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Monday, November 16, 2026')).toBe(`Edge, ${longDate('2026-11-16')}, Span, ${longRange('2026-11-16', '2026-11-18')}`);
    expect(describedBy('Tuesday, November 17, 2026')).toBe(`Span, ${longRange('2026-11-16', '2026-11-18')}`);
    expect(describedBy('Wednesday, November 18, 2026')).toBe(`Span, ${longRange('2026-11-16', '2026-11-18')}`);
    expect(describedBy('Thursday, November 19, 2026')).toBe('');
  });

  it('opens the pressed day and focuses its first event', () => {
    openMonth();
    fireEvent.click(screen.getByRole('button', { name: 'Thursday, November 19, 2026' }));
    expect(screen.getByRole('heading', { name: 'Thu, Nov 19' })).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
    const planning = screen.getByRole('button', { name: `Planning, ${clock('10:00')} to ${clock('12:00')}` });
    expect(document.activeElement).toBe(planning);
  });

  it('focuses the day heading when the pressed day has no event', () => {
    openMonth();
    fireEvent.click(screen.getByRole('button', { name: 'Sunday, November 8, 2026' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Sun, Nov 8' }));
    expect(screen.queryByRole('button', { name: /Design review|Planning|Offsite/ })).toBeNull();
  });

  it('moves the month from the header and leaves focus on that button', () => {
    openMonth();
    const next = screen.getByRole('button', { name: 'Next month' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByText('December 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wednesday, December 16, 2026' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Monday, November 16, 2026' })).toBeNull();
    expect(document.activeElement).toBe(next);
  });

  it('moves a month from Page Down and focuses that month’s same day', () => {
    openMonth();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday, November 16, 2026' }), { key: 'PageDown' });
    expect(screen.getByText('December 2026')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Wednesday, December 16, 2026' }));
  });

  it('cancels Page Up and Page Down so the page does not scroll', () => {
    openMonth();
    const day = screen.getByRole('button', { name: 'Monday, November 16, 2026' });
    for (const key of ['PageUp', 'PageDown']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      day.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it('moves a year from Shift and Page Down', () => {
    openMonth();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday, November 16, 2026' }), { key: 'PageDown', shiftKey: true });
    expect(screen.getByRole('grid', { name: 'November 2027' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tuesday, November 16, 2027' }));
  });

  it('names the focused month when arrowing across the month boundary', () => {
    openMonth();
    let current: HTMLElement = screen.getByRole('button', { name: 'Monday, November 16, 2026' });
    current.focus();
    for (let step = 0; step < 4; step += 1) {
      fireEvent.keyDown(current, { key: 'ArrowDown' });
      current = document.activeElement as HTMLElement;
    }
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'December 2026' })).toBeTruthy();
    expect(current).toBe(screen.getByRole('button', { name: 'Monday, December 14, 2026' }));
    expect(screen.queryByRole('grid', { name: 'November 2026' })).toBeNull();
  });

  it('names the focused month in Korean when arrowing across the month boundary', () => {
    openMonth('ko');
    let current: HTMLElement = screen.getByRole('button', { name: '2026년 11월 16일 월요일' });
    current.focus();
    for (let step = 0; step < 4; step += 1) {
      fireEvent.keyDown(current, { key: 'ArrowDown' });
      current = document.activeElement as HTMLElement;
    }
    expect(screen.getByRole('grid', { name: '2026년 12월' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026년 12월' })).toBeTruthy();
    expect(current).toBe(screen.getByRole('button', { name: '2026년 12월 14일 월요일' }));
    expect(screen.queryByRole('grid', { name: '2026년 11월' })).toBeNull();
  });

  it('counts a bar that does not fit together with the titles that do not fit', () => {
    const events = [
      event('a', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-19T00:00:00-08:00[America/Los_Angeles]', { title: 'Alpha', allDay: true }),
      event('b', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-18T00:00:00-08:00[America/Los_Angeles]', { title: 'Beta', allDay: true }),
      event('c', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', { title: 'Gamma', allDay: true }),
      event('d', '2026-11-16T10:00:00-08:00[America/Los_Angeles]', '2026-11-16T11:00:00-08:00[America/Los_Angeles]', { title: 'Delta' }),
    ];
    render(<EventCalendarExample locale="en-US" events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Monday, November 16, 2026')).toBe(`Alpha, ${longRange('2026-11-16', '2026-11-18')}, Beta, ${longRange('2026-11-16', '2026-11-17')}, +2 more`);
  });

  it('lists an all-day event before a timed event that starts at the same time', () => {
    const events = [
      event('alpha', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-16T01:00:00-08:00[America/Los_Angeles]', { title: 'Alpha' }),
      event('zebra', '2026-11-16T00:00:00-08:00[America/Los_Angeles]', '2026-11-17T00:00:00-08:00[America/Los_Angeles]', { title: 'Zebra', allDay: true }),
    ];
    render(<EventCalendarExample locale="en-US" events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Monday, November 16, 2026')).toBe(`Zebra, ${longDate('2026-11-16')}, Alpha`);
  });

  it('opens the week that contains the pressed Sunday, in English and Korean', () => {
    openMonth();
    fireEvent.click(screen.getByRole('button', { name: 'Sunday, November 15, 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText('Nov 15 – Nov 21, 2026')).toBeTruthy();
    cleanup();
    openMonth('ko');
    fireEvent.click(screen.getByRole('button', { name: '2026년 11월 15일 일요일' }));
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText('11월 15일 – 2026년 11월 21일')).toBeTruthy();
  });

  const reachedWeek = 'Dec 13 – Dec 19, 2026';

  it('opens the week of the day Next month reaches', () => {
    openMonth();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText(reachedWeek)).toBeTruthy();
  });

  it('opens the week of the day Arrow Down reaches', () => {
    openMonth();
    let current: HTMLElement = screen.getByRole('button', { name: 'Monday, November 16, 2026' });
    current.focus();
    for (let step = 0; step < 4; step += 1) {
      fireEvent.keyDown(current, { key: 'ArrowDown' });
      current = document.activeElement as HTMLElement;
    }
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText(reachedWeek)).toBeTruthy();
  });

  it('opens the week and the day Page Down reaches', () => {
    openMonth();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday, November 16, 2026' }), { key: 'PageDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText(reachedWeek)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getByRole('heading', { name: 'Wed, Dec 16' })).toBeTruthy();
  });

  it('keeps a far anchor focused and unselected through StrictMode remounts', () => {
    const anchor = Temporal.PlainDate.from('2027-03-10');
    render(
      <StrictMode>
        <EventCalendarExample locale="en-US" anchor={anchor} />
      </StrictMode>,
    );
    for (let turn = 0; turn < 3; turn += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Month' }));
      fireEvent.click(screen.getByRole('button', { name: 'Week' }));
      fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    }
    const day = screen.getByRole('button', { name: 'Wednesday, March 10, 2027' });
    expect(day.tabIndex).toBe(0);
    expect(day.hasAttribute('data-selected')).toBe(false);
    expect(day.closest('td')?.getAttribute('aria-selected')).toBeNull();
    expect(screen.getByRole('grid', { name: 'March 2027' })).toBeTruthy();
  });

  it('renders the month in Korean', () => {
    openMonth('ko');
    expect(screen.getByText('2026년 11월')).toBeTruthy();
    expect(describedBy('2026년 11월 16일 월요일')).toBe(`Offsite, ${longDate('2026-11-16', 'ko')}, Handoff, ${longRange('2026-11-16', '2026-11-17', 'ko')}, +2 more`);
    expect(screen.getByRole('button', { name: '2026년 12월 1일 화요일' })).toBeTruthy();
  });
});

const monday = () => lane(daySegments({ days: weekOf(date('2026-11-16'), 'en-US'), opens: time('08:00'), closes: time('18:00'), timeZone: LA }), '2026-11-16');

describe('moving and resizing a timed event', () => {
  it('snaps to the nearer slot, and to the earlier slot when the two are equally near', () => {
    expect(snapToSlot(67, SLOT_MINUTES, 600)).toBe(60);
    expect(snapToSlot(68, SLOT_MINUTES, 600)).toBe(75);
    expect(snapToSlot(67.5, SLOT_MINUTES, 600)).toBe(60);
    expect(snapToSlot(610, SLOT_MINUTES, 600)).toBe(600);
  });

  it('clamps a move into the day and keeps its length', () => {
    const current = { start: 60, end: 150 };
    expect(clampSpan(current, { start: -20, end: 70 }, 600, SLOT_MINUTES, 'move')).toEqual({ start: 0, end: 90 });
    expect(clampSpan(current, { start: 560, end: 650 }, 600, SLOT_MINUTES, 'move')).toEqual({ start: 510, end: 600 });
  });

  it('clamps a resize to the day and to one slot', () => {
    expect(clampSpan({ start: 60, end: 150 }, { start: 60, end: 610 }, 600, SLOT_MINUTES, 'end')).toEqual({ start: 60, end: 600 });
    expect(clampSpan({ start: 60, end: 150 }, { start: 148, end: 150 }, 600, SLOT_MINUTES, 'start')).toEqual({ start: 135, end: 150 });
    expect(clampSpan({ start: 0, end: 15 }, { start: 0, end: 0 }, 600, SLOT_MINUTES, 'end')).toEqual({ start: 0, end: 15 });
  });

  it('restores the original event when a drag is cancelled', () => {
    const original = event('review', '2026-11-16T09:00:00-08:00[America/Los_Angeles]', '2026-11-16T10:30:00-08:00[America/Los_Angeles]');
    const moved = { ...original, start: original.start.add({ minutes: 30 }), end: original.end.add({ minutes: 30 }) };
    expect(finishGesture(original, moved, 'escape')).toBe(original);
    expect(finishGesture(original, null, 'drop')).toBe(original);
    expect(finishGesture(original, moved, 'drop')).toBe(moved);
  });

  it('shifts, lengthens, and moves a day by one slot, and refuses a step that leaves the lane', () => {
    const axis = daySegments({ days: weekOf(date('2026-11-16'), 'en-US'), opens: time('08:00'), closes: time('18:00'), timeZone: LA });
    const segment = monday();
    const review = event('review', '2026-11-16T09:00:00-08:00[America/Los_Angeles]', '2026-11-16T10:30:00-08:00[America/Los_Angeles]', { title: 'Design review' });
    const later = adjustEvent(review, segment, axis, { kind: 'shift', slots: 1 });
    expect(later?.start.toString()).toBe('2026-11-16T09:15:00-08:00[America/Los_Angeles]');
    expect(later?.end.toString()).toBe('2026-11-16T10:45:00-08:00[America/Los_Angeles]');
    const longer = adjustEvent(review, segment, axis, { kind: 'length', slots: 1 });
    expect(longer?.end.toString()).toBe('2026-11-16T10:45:00-08:00[America/Los_Angeles]');
    expect(longer?.start.toString()).toBe(review.start.toString());
    const nextDay = adjustEvent(review, segment, axis, { kind: 'day', days: 1 });
    expect(nextDay?.start.toPlainDate().toString()).toBe('2026-11-17');
    expect(nextDay?.start.toPlainTime().toString()).toBe('09:00:00');
    const early = event('early', '2026-11-18T07:00:00-08:00[America/Los_Angeles]', '2026-11-18T09:00:00-08:00[America/Los_Angeles]');
    const wednesday = lane(axis, '2026-11-18');
    expect(adjustEvent(early, wednesday, axis, { kind: 'shift', slots: -1 })).toBeNull();
    const ship = event('ship', '2026-11-19T15:00:00-08:00[America/Los_Angeles]', '2026-11-19T18:30:00-08:00[America/Los_Angeles]');
    expect(adjustEvent(ship, lane(axis, '2026-11-19'), axis, { kind: 'length', slots: 1 })).toBeNull();
    expect(adjustEvent(review, segment, axis, { kind: 'day', days: -8 })).toBeNull();
    const offGrid = event('edge', '2026-11-16T08:07:00-08:00[America/Los_Angeles]', '2026-11-16T09:00:00-08:00[America/Los_Angeles]');
    expect(adjustEvent(offGrid, segment, axis, { kind: 'shift', slots: -1 })).toBeNull();
  });

  it('keeps the shown time when a day move crosses a clock change in another zone', () => {
    const axis = daySegments({
      days: [date('2026-10-31'), date('2026-11-01')],
      opens: time('08:00'),
      closes: time('18:00'),
      timeZone: LA,
    });
    const segment = lane(axis, '2026-10-31');
    const start = Temporal.PlainDateTime.from('2026-10-31T10:00').toZonedDateTime(LA).withTimeZone('Asia/Tokyo');
    const end = Temporal.PlainDateTime.from('2026-10-31T11:00').toZonedDateTime(LA).withTimeZone('Asia/Tokyo');
    const talk = event('tokyo', start.toString(), end.toString(), { title: 'Tokyo' });
    const moved = adjustEvent(talk, segment, axis, { kind: 'day', days: 1 });
    expect(moved?.start.withTimeZone(LA).toString()).toBe('2026-11-01T10:00:00-08:00[America/Los_Angeles]');
    expect(moved?.end.withTimeZone(LA).toString()).toBe('2026-11-01T11:00:00-08:00[America/Los_Angeles]');
    const dragged = eventFromLane(
      talk,
      { from: { day: segment.day, start: 120, end: 180 }, to: { day: date('2026-11-01'), start: 120, end: 180 }, kind: 'move' },
      axis,
    );
    expect(dragged?.start.withTimeZone(LA).toString()).toBe('2026-11-01T10:00:00-08:00[America/Los_Angeles]');
  });

  it('moves to a later day at an earlier time, and back to an earlier day at a later time', () => {
    const axis = daySegments({ days: [date('2026-11-16'), date('2026-11-17')], opens: time('08:00'), closes: time('18:00'), timeZone: LA });
    const review = event('review', '2026-11-16T10:00:00-08:00[America/Los_Angeles]', '2026-11-16T11:30:00-08:00[America/Los_Angeles]');
    const tuesday = eventFromLane(
      review,
      { from: { day: date('2026-11-16'), start: 120, end: 210 }, to: { day: date('2026-11-17'), start: 60, end: 150 }, kind: 'move' },
      axis,
    );
    expect(tuesday?.start.toString()).toBe('2026-11-17T09:00:00-08:00[America/Los_Angeles]');
    expect(tuesday?.end.toString()).toBe('2026-11-17T10:30:00-08:00[America/Los_Angeles]');
    if (!tuesday) throw new Error('expected the Tuesday event');
    const monday = eventFromLane(
      tuesday,
      { from: { day: date('2026-11-17'), start: 60, end: 150 }, to: { day: date('2026-11-16'), start: 120, end: 210 }, kind: 'move' },
      axis,
    );
    expect(monday?.start.toString()).toBe('2026-11-16T10:00:00-08:00[America/Los_Angeles]');
    expect(monday?.end.toString()).toBe('2026-11-16T11:30:00-08:00[America/Los_Angeles]');
  });

  it('refuses a day move that would pass the shorter day close', () => {
    const axis = daySegments({
      days: [date('2026-03-08'), date('2026-03-09')],
      opens: time('01:00'),
      closes: time('04:00'),
      timeZone: LA,
    });
    expect(lane(axis, '2026-03-08').length).toBe(120);
    expect(lane(axis, '2026-03-09').length).toBe(180);
    const sync = event('sync', '2026-03-09T01:00:00-07:00[America/Los_Angeles]', '2026-03-09T03:30:00-07:00[America/Los_Angeles]');
    expect(adjustEvent(sync, lane(axis, '2026-03-09'), axis, { kind: 'day', days: -1 })).toBeNull();
  });

  it('keeps a drop at the minutes the drag already chose', () => {
    const axis = daySegments({ days: [date('2026-11-16')], opens: time('08:00'), closes: time('18:00'), timeZone: LA });
    const segment = lane(axis, '2026-11-16');
    const review = event('review', '2026-11-16T09:00:00-08:00[America/Los_Angeles]', '2026-11-16T10:30:00-08:00[America/Los_Angeles]');
    const moved = eventFromLane(review, { from: { day: segment.day, start: 60, end: 150 }, to: { day: segment.day, start: 72, end: 162 }, kind: 'move' }, axis);
    expect(moved?.start.toString()).toBe('2026-11-16T09:12:00-08:00[America/Los_Angeles]');
    expect(moved?.end.toString()).toBe('2026-11-16T10:42:00-08:00[America/Los_Angeles]');
  });

  it('moves the end with the date and with the start', () => {
    const draft = { title: 'Design review', date: date('2026-11-16'), endDate: date('2026-11-16'), start: time('09:00'), end: time('10:30'), allDay: false };
    const dated = shiftDraft(draft, 'date', date('2026-11-24'), LA);
    expect(dated.date?.toString()).toBe('2026-11-24');
    expect(dated.endDate?.toString()).toBe('2026-11-24');
    expect(dated.end?.toString()).toBe('10:30:00');
    const started = shiftDraft(draft, 'start', time('19:00'), LA);
    expect(started.start?.toString()).toBe('19:00:00');
    expect(started.end?.toString()).toBe('20:30:00');
    expect(started.endDate?.toString()).toBe('2026-11-16');
  });

  it('moves a clipped event by the snapped delta, so the hidden part comes with it', () => {
    const axis = daySegments({ days: [date('2026-11-18')], opens: time('08:00'), closes: time('18:00'), timeZone: LA });
    const segment = lane(axis, '2026-11-18');
    const early = event('early', '2026-11-18T07:00:00-08:00[America/Los_Angeles]', '2026-11-18T09:00:00-08:00[America/Los_Angeles]', { title: 'Early sync' });
    const moved = eventFromLane(
      early,
      { from: { day: segment.day, start: 0, end: 60 }, to: { day: segment.day, start: 30, end: 90 }, kind: 'move' },
      axis,
    );
    expect(moved?.start.toString()).toBe('2026-11-18T07:30:00-08:00[America/Los_Angeles]');
    expect(moved?.end.toString()).toBe('2026-11-18T09:30:00-08:00[America/Los_Angeles]');
  });

  it('rejects an end that is not after the start, and saves a valid draft', () => {
    const zone = LA;
    const invalid = eventFromDraft(
      { title: 'Design review', date: date('2026-11-16'), endDate: date('2026-11-16'), start: time('09:00'), end: time('08:00'), allDay: false },
      zone,
    );
    expect(invalid).toEqual({ ok: false, issue: { field: 'end', message: 'End must be after the start.' } });
    const sameInstant = eventFromDraft(
      { title: 'Design review', date: date('2026-11-16'), endDate: date('2026-11-16'), start: time('09:00'), end: time('09:00'), allDay: false },
      zone,
    );
    expect(sameInstant).toEqual({ ok: false, issue: { field: 'end', message: 'End must be after the start.' } });
    const saved = eventFromDraft(
      { title: '  Design review  ', date: date('2026-11-16'), endDate: date('2026-11-16'), start: time('09:00'), end: time('11:00'), allDay: false },
      zone,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('expected a saved draft');
    expect(saved.value.title).toBe('Design review');
    expect(saved.value.start.toString()).toBe('2026-11-16T09:00:00-08:00[America/Los_Angeles]');
    expect(saved.value.end.toString()).toBe('2026-11-16T11:00:00-08:00[America/Los_Angeles]');
    const missingEnd = eventFromDraft({ title: 'Offsite', date: date('2026-11-16'), endDate: null, start: null, end: null, allDay: true }, zone);
    expect(missingEnd).toEqual({ ok: false, issue: { field: 'endDate', message: 'Choose an end.' } });
    const backwards = eventFromDraft(
      { title: 'Retreat', date: date('2026-11-20'), endDate: date('2026-11-19'), start: null, end: null, allDay: true },
      zone,
    );
    expect(backwards).toEqual({ ok: false, issue: { field: 'endDate', message: 'End must be after the start.' } });
    const allDay = eventFromDraft({ title: 'Offsite', date: date('2026-11-16'), endDate: date('2026-11-16'), start: null, end: null, allDay: true }, zone);
    expect(allDay.ok).toBe(true);
    if (!allDay.ok) throw new Error('expected an all-day draft');
    expect(allDay.value.allDay).toBe(true);
    expect(allDay.value.start.toString()).toBe('2026-11-16T00:00:00-08:00[America/Los_Angeles]');
    expect(allDay.value.end.toString()).toBe('2026-11-17T00:00:00-08:00[America/Los_Angeles]');
    const retreat = eventFromDraft({ title: 'Retreat', date: date('2026-11-20'), endDate: date('2026-11-22'), start: null, end: null, allDay: true }, zone);
    expect(retreat.ok).toBe(true);
    if (!retreat.ok) throw new Error('expected a retreat draft');
    expect(retreat.value.start.toString()).toBe('2026-11-20T00:00:00-08:00[America/Los_Angeles]');
    expect(retreat.value.end.toString()).toBe('2026-11-23T00:00:00-08:00[America/Los_Angeles]');
  });
});

describe('the event menu and dialog', () => {
  afterEach(cleanup);

  const polite = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');

  const openMenu = async () => {
    let menu: HTMLElement | undefined;
    await vi.waitFor(() => {
      menu = screen.getAllByRole('menu', { hidden: true }).find((each) => each.hasAttribute('data-popover-open'));
      expect(menu).toBeDefined();
    });
    return menu!;
  };

  async function choose(name: string, item: string) {
    const trigger = screen.getByRole('button', { name });
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.click(trigger);
    });
    const menu = await openMenu();
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: item }));
    });
  }

  it('moves an event one slot from the menu, announces the new time, and returns focus', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const name = `Design review, ${clock('09:00')} to ${clock('10:30')}`;
    await choose(name, '15 minutes later');
    const moved = screen.getByRole('button', { name: `Design review, ${clock('09:15')} to ${clock('10:45')}` });
    expect(document.activeElement).toBe(moved);
    await vi.waitFor(() => expect(polite()?.textContent).toBe(`Design review, ${clock('09:15')} to ${clock('10:45')}`));
  });

  it('repacks overlapping columns after a move, and shows the event on its new day in the month', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const review = () => screen.getByRole('button', { name: /^Design review,/ });
    const standup = () => screen.getByRole('button', { name: /^Standup,/ });
    expect(standup().parentElement?.style.inlineSize).toBe('50%');
    await choose(review().getAttribute('aria-label')!, '15 minutes later');
    await choose(review().getAttribute('aria-label')!, '15 minutes later');
    expect(review().getAttribute('aria-label')).toBe(`Design review, ${clock('09:30')} to ${clock('11:00')}`);
    expect(standup().parentElement?.style.inlineSize).toBe('100%');
    expect(review().parentElement?.style.inlineSize).toBe('100%');

    await choose(review().getAttribute('aria-label')!, 'Move to next day');
    expect(screen.getByRole('list', { name: 'Tue, Nov 17' }).contains(review())).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Monday, November 16, 2026')).toBe(`Offsite, ${longDate('2026-11-16')}, Handoff, ${longRange('2026-11-16', '2026-11-17')}, +1 more`);
    expect(describedBy('Tuesday, November 17, 2026')).toBe(`Handoff, ${longRange('2026-11-16', '2026-11-17')}, Design review, +1 more`);
  });

  it('hides day moves on the day view, and disables a step that would leave the lane', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    const early = screen.getByRole('button', { name: /^Early sync,/ });
    await act(async () => {
      fireEvent.pointerDown(early, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.pointerUp(early, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.click(early);
    });
    const menu = await openMenu();
    expect(within(menu).queryByRole('menuitem', { name: 'Move to next day' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: '15 minutes earlier' }).getAttribute('aria-disabled')).toBe('true');
    const before = early.getAttribute('aria-label');
    fireEvent.click(within(menu).getByRole('menuitem', { name: '15 minutes earlier' }));
    expect(early.getAttribute('aria-label')).toBe(before);
  });

  it('disables a day move onto a shorter day', async () => {
    const sync = event('sync', '2026-03-09T01:00:00-07:00[America/Los_Angeles]', '2026-03-09T03:30:00-07:00[America/Los_Angeles]', { title: 'Sync' });
    render(<EventCalendarExample locale="en-US" timeZone={LA} anchor={date('2026-03-09')} opens={time('01:00')} closes={time('04:00')} events={[sync]} />);
    const button = screen.getByRole('button', { name: `Sync, ${clock('01:00')} to ${clock('03:30')}` });
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.pointerUp(button, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.click(button);
    });
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Move to previous day' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Move to previous day' }));
    expect(screen.getByRole('list', { name: 'Mon, Mar 9' }).contains(button)).toBe(true);
  });

  it('shows a field error when the end is not after the start, then saves a later end', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(`Design review, ${clock('09:00')} to ${clock('10:30')}`, 'Edit…');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Design review' });
    const end = within(dialog).getByRole('textbox', { name: 'End' }) as HTMLInputElement;
    fireEvent.change(end, { target: { value: '8:00 AM' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('End must be after the start.')).toBeTruthy();
    fireEvent.change(end, { target: { value: '11:00 AM' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const saved = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('11:00')}` });
    expect(document.activeElement).toBe(saved);
  });

  it('opens the dialog on the title', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(`Design review, ${clock('09:00')} to ${clock('10:30')}`, 'Edit…');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Design review' });
    await vi.waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('textbox', { name: 'Title' })));
  });

  it('keeps the length when only the date changes, and focuses the event on its new week', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(`Design review, ${clock('09:00')} to ${clock('10:30')}`, 'Edit…');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Design review' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Date' }), { target: { value: '11/24/2026' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const saved = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    expect(screen.getByRole('list', { name: 'Tue, Nov 24' }).contains(saved)).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Mon, Nov 16' })).toBeNull();
    expect(document.activeElement).toBe(saved);
  });

  it('keeps Retreat on Friday through Sunday when Save changes nothing', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(`Retreat, ${longRange('2026-11-20', '2026-11-22')}`, 'Edit…');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Retreat' });
    expect((within(dialog).getByRole('textbox', { name: 'End date' }) as HTMLInputElement).value).toContain('22');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: `Retreat, ${longRange('2026-11-20', '2026-11-22')}` })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Friday, November 20, 2026')).toContain(`Retreat, ${longRange('2026-11-20', '2026-11-22')}`);
    expect(describedBy('Sunday, November 22, 2026')).toContain('Retreat');
    expect(describedBy('Monday, November 23, 2026')).not.toContain('Retreat');
  });

  it('moves an all-day bar by a day, and turns it into the opening slot', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(`Offsite, ${longDate('2026-11-16')}`, 'Move to next day');
    const moved = screen.getByRole('button', { name: `Offsite, ${longDate('2026-11-17')}` });
    expect(screen.queryByRole('button', { name: `Offsite, ${longDate('2026-11-16')}` })).toBeNull();
    await choose(moved.getAttribute('aria-label')!, 'Edit…');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Offsite' });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'All day' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const timed = screen.getByRole('button', { name: `Offsite, ${clock('08:00')} to ${clock('08:15')}` });
    expect(screen.getByRole('list', { name: 'Tue, Nov 17' }).contains(timed)).toBe(true);
  });

  it('keeps focus on Offsite after Move to next day leaves the day view', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    await choose(`Offsite, ${longDate('2026-11-16')}`, 'Move to next day');
    const moved = screen.getByRole('button', { name: `Offsite, ${longDate('2026-11-17')}` });
    expect(screen.getByRole('heading', { name: 'Tue, Nov 17' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Mon, Nov 16' })).toBeNull();
    expect(document.activeElement).toBe(moved);
    await vi.waitFor(() => expect(polite()?.textContent).toBe(`Offsite, ${longDate('2026-11-17')}`));
  });

  it('keeps focus on a one-day all-day bar after it moves from Saturday onto the next week', async () => {
    const saturday = event('hours', '2026-11-21T00:00:00-08:00[America/Los_Angeles]', '2026-11-22T00:00:00-08:00[America/Los_Angeles]', { title: 'Office hours', allDay: true });
    render(<EventCalendarExample locale="en-US" timeZone={LA} anchor={date('2026-11-16')} events={[saturday]} />);
    await choose(`Office hours, ${longDate('2026-11-21')}`, 'Move to next day');
    const moved = screen.getByRole('button', { name: `Office hours, ${longDate('2026-11-22')}` });
    expect(screen.getByRole('heading', { name: 'Sun, Nov 22' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Sat, Nov 21' })).toBeNull();
    expect(document.activeElement).toBe(moved);
    await vi.waitFor(() => expect(polite()?.textContent).toBe(`Office hours, ${longDate('2026-11-22')}`));
  });

  it('focuses the strip bar when Save makes an event all-day, and the day heading when it leaves the lanes and the strip', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const name = `Design review, ${clock('09:00')} to ${clock('10:30')}`;
    await choose(name, 'Edit…');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Design review' });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'All day' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const strip = screen.getByRole('button', { name: `Design review, ${longDate('2026-11-16')}` });
    expect(screen.getByRole('list', { name: 'Mon, Nov 16' }).contains(strip)).toBe(false);
    expect(document.activeElement).toBe(strip);
    cleanup();

    render(<EventCalendarExample locale="en-US" />);
    await choose(name, 'Edit…');
    const again = await screen.findByRole('dialog', { name: 'Edit Design review' });
    fireEvent.change(within(again).getByRole('textbox', { name: 'Start' }), { target: { value: '7:00 PM' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Design review,/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Mon, Nov 16' }));
  });

  it('counts the remainder of a skipped-hour series, and saves the start that was typed', async () => {
    const zone = 'America/Los_Angeles';
    const start = Temporal.ZonedDateTime.from('2027-03-14T03:30:00-07:00[America/Los_Angeles]');
    const end = start.add({ hours: 1 });
    const later = Temporal.ZonedDateTime.from('2027-03-21T02:30:00-07:00[America/Los_Angeles]');
    const occurrence = {
      id: 'later',
      seriesId: 'later',
      title: 'Later',
      start: later,
      end: later.add({ hours: 1 }),
      allDay: false,
      repeats: true,
      originalStart: later,
    };
    const template = {
      id: 'later',
      seriesId: 'later',
      title: 'Later',
      start,
      end,
      allDay: false,
      repeats: true,
      originalStart: start,
    };
    const rule = { freq: 'WEEKLY' as const, interval: 1, byDay: ['SU' as const], end: { kind: 'count' as const, count: 4 } };
    let saved: { start: Temporal.ZonedDateTime; startTime?: Temporal.PlainTime } | null = null;
    render(
      <EventEditor
        event={occurrence}
        locale="en-US"
        timeZone={zone}
        rule={rule}
        template={template}
        wallTime={time('02:30')}
        chooseScope
        onSave={(event, detail) => {
          saved = { start: event.start, startTime: detail.startTime };
        }}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'This and following' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Later' });
    expect((within(form).getByRole('spinbutton', { name: 'Times' }) as HTMLInputElement).value).toBe('3');
    cleanup();

    const spring = {
      id: 'later',
      seriesId: 'later',
      title: 'Later',
      start,
      end,
      allDay: false,
      repeats: true,
      originalStart: start,
    };
    render(
      <EventEditor
        event={spring}
        locale="en-US"
        timeZone={zone}
        rule={rule}
        template={template}
        wallTime={time('02:30')}
        chooseScope
        onSave={(event, detail) => {
          saved = { start: event.start, startTime: detail.startTime };
        }}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'This and following' }));
    const gap = await screen.findByRole('dialog', { name: 'Edit Later' });
    const startField = within(gap).getByRole('textbox', { name: 'Start' });
    fireEvent.change(startField, { target: { value: '2:00 AM' } });
    fireEvent.blur(startField);
    fireEvent.click(within(gap).getByRole('button', { name: 'Save' }));
    expect(saved?.startTime?.toString()).toBe('02:00:00');
    expect(saved?.start.toPlainTime().toString()).toBe('03:00:00');
  });

  it('cancels the dialog on Escape and keeps the event', async () => {
    render(
      <EventEditor
        event={event('review', '2026-11-16T09:00:00-08:00[America/Los_Angeles]', '2026-11-16T10:30:00-08:00[America/Los_Angeles]', { title: 'Design review' })}
        locale="en-US"
        timeZone={LA}
        onSave={() => {
          throw new Error('save');
        }}
        onCancel={() => {
          document.body.dataset.cancelled = 'yes';
        }}
      />,
    );
    const dialog = document.querySelector('dialog');
    expect(dialog).toBeTruthy();
    dialog?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await vi.waitFor(() => expect(document.body.dataset.cancelled).toBe('yes'));
    delete document.body.dataset.cancelled;
  });
});

function shortZone(timeZone: string, locale: string): string {
  return (
    new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone, timeZoneName: 'short' })
      .formatToParts(Date.UTC(2026, 10, 16, 16))
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  );
}

function calendarBoard(): HTMLElement {
  const board = document.querySelector<HTMLElement>('[aria-label="Calendar"]');
  if (!board) throw new Error('missing calendar');
  return board;
}

function described(): string[] {
  return (calendarBoard().getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

function cornerText(value: string) {
  return (_content: string, node: Element | null) => node?.textContent === value && [...(node.classList ?? [])].some((name) => name.includes('_zone_'));
}

function hourColumns(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].filter((el) => [...el.children].some((child) => (child as HTMLElement).style?.top));
}

const once = (start: Temporal.Instant | Temporal.ZonedDateTime, end: Temporal.Instant | Temporal.ZonedDateTime) => ({
  id: 'once',
  title: 'Once',
  start,
  end,
  allDay: false as const,
});

describe('the time zone', () => {
  it('names the grid zone in English and Korean', () => {
    const zone = Temporal.Now.timeZoneId();
    render(<EventCalendarExample locale="en-US" events={[]} />);
    expect(screen.getByText(shortZone(zone, 'en-US'))).toBeTruthy();
    expect(described()[0]?.startsWith('Times in')).toBe(true);
    expect(described()[0]).toContain(shortZone(zone, 'en-US'));
    expect(described()[0] && screen.getByText(described()[0]!).closest('[aria-hidden="true"]')).toBeNull();
    cleanup();

    render(<EventCalendarExample locale="ko" events={[]} />);
    expect(screen.getByText(shortZone(zone, 'ko'))).toBeTruthy();
    expect(described()[0]?.startsWith('시각은')).toBe(true);
    expect(described()[0]).toContain(shortZone(zone, 'ko'));
    cleanup();

    render(<EventCalendarExample locale="en-US" timeZone={LA} events={[]} />);
    expect(screen.getByText('PST')).toBeTruthy();
    expect(described()).toEqual(['Times in PST (GMT-8).']);
    cleanup();

    render(<EventCalendarExample locale="ko" timeZone={LA} events={[]} />);
    expect(screen.getByText('GMT-8')).toBeTruthy();
    expect(described()).toEqual(['시각은 GMT-8입니다.']);
  });

  it('places one instant in a different hour for a different zone', () => {
    const start = Temporal.Instant.from('2026-11-16T17:00:00Z');
    const end = Temporal.Instant.from('2026-11-16T18:00:00Z');
    const zoned = once(start.toZonedDateTimeISO('Asia/Tokyo'), end.toZonedDateTimeISO('Asia/Tokyo'));
    render(<EventCalendarExample locale="en-US" timeZone={LA} anchor={date('2026-11-16')} events={[once(start, end)]} />);
    const pacific = screen.getByRole('button', { name: `Once, ${clock('09:00')} to ${clock('10:00')}` });
    expect(screen.getByRole('list', { name: 'Mon, Nov 16' }).contains(pacific)).toBe(true);
    expect(pacific.parentElement?.style.top).toBe('10%');
    cleanup();

    render(<EventCalendarExample locale="en-US" timeZone="UTC" anchor={date('2026-11-16')} events={[once(start, end)]} />);
    const utc = screen.getByRole('button', { name: `Once, ${clock('17:00')} to ${clock('18:00')}` });
    expect(utc.parentElement?.style.top).toBe('90%');
    cleanup();

    render(<EventCalendarExample locale="en-US" timeZone={LA} anchor={date('2026-11-16')} events={[zoned]} />);
    const same = screen.getByRole('button', { name: `Once, ${clock('09:00')} to ${clock('10:00')}` });
    expect(screen.getByRole('list', { name: 'Mon, Nov 16' }).contains(same)).toBe(true);
    expect(same.parentElement?.style.top).toBe('10%');
  });

  it('shows the second zone’s hour, including a partial offset and a day shift', () => {
    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Kolkata" anchor={date('2026-11-16')} events={[]} />);
    expect(described()).toEqual(['Times in PST (GMT-8). Second column GMT+5:30, 13 h 30 min ahead.']);
    const columns = hourColumns();
    expect(columns).toHaveLength(2);
    const primary = [...columns[0]!.querySelectorAll<HTMLElement>('span')];
    const compare = [...columns[1]!.querySelectorAll<HTMLElement>('span')];
    const open = primary.find((node) => node.textContent === clock('08:00'));
    const late = primary.find((node) => node.textContent === clock('17:00'));
    expect(open).toBeTruthy();
    expect(late).toBeTruthy();
    expect(compare.find((node) => node.style.top === open!.style.top)?.textContent).toBe(clock('21:30'));
    expect(compare.find((node) => node.style.top === late!.style.top)?.textContent).toBe(`${clock('06:30')} +1 day`);
    cleanup();

    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Kathmandu" anchor={date('2026-11-16')} events={[]} />);
    expect(screen.getByText(cornerText('GMT+5:45'))).toBeTruthy();
    const kathmandu = hourColumns()[1];
    const eight = hourColumns()[0]?.querySelector<HTMLElement>('span')?.style.top;
    expect([...kathmandu!.querySelectorAll<HTMLElement>('span')].find((node) => node.style.top === eight)?.textContent).toBe(clock('21:45'));
    cleanup();

    render(<EventCalendarExample locale="ko" timeZone={LA} compareZone="Asia/Kolkata" anchor={date('2026-11-16')} events={[]} />);
    const koTime = (text: string) => formatTime(Temporal.PlainTime.from(text), { locale: 'ko' });
    const koColumns = hourColumns();
    const koLate = [...koColumns[0]!.querySelectorAll<HTMLElement>('span')].find((node) => node.textContent === koTime('17:00'));
    expect([...koColumns[1]!.querySelectorAll<HTMLElement>('span')].find((node) => node.style.top === koLate?.style.top)?.textContent).toBe(`${koTime('06:30')} +1일`);
  });

  it('keeps spring-forward and fall-back hours and lines the second zone up with them', () => {
    const spring = once(Temporal.Instant.from('2027-03-14T10:00:00Z'), Temporal.Instant.from('2027-03-14T10:30:00Z'));
    render(
      <EventCalendarExample locale="en-US" timeZone={LA} compareZone="UTC" anchor={SPRING} opens={time('00:00')} closes={time('04:00')} events={[spring]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    const [primary, compare] = hourColumns();
    const labels = [...primary!.querySelectorAll<HTMLElement>('span')].map((node) => node.textContent);
    expect(labels).toEqual([clock('00:00'), clock('01:00'), clock('03:00')]);
    expect(labels).not.toContain(clock('02:00'));
    const other = [...compare!.children] as HTMLElement[];
    expect(other.map((node) => node.textContent)).toEqual([clock('08:00'), clock('09:00'), clock('10:00')]);
    expect(other.map((node) => node.style.top)).toEqual([...primary!.querySelectorAll<HTMLElement>('span')].map((node) => node.style.top));
    const gap = screen.getByRole('button', { name: `Once, ${clock('03:00')} to ${clock('03:30')}` });
    expect(gap.parentElement?.style.top).toBe('66.6667%');
    cleanup();

    const repeated = once(Temporal.Instant.from('2027-11-07T09:00:00Z'), Temporal.Instant.from('2027-11-07T09:30:00Z'));
    render(
      <EventCalendarExample locale="en-US" timeZone={LA} compareZone="UTC" anchor={FALL} opens={time('00:00')} closes={time('04:00')} events={[repeated]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    const [fallPrimary, fallCompare] = hourColumns();
    const fallLabels = [...fallPrimary!.querySelectorAll<HTMLElement>('span')];
    const ones = fallLabels.filter((node) => node.textContent === clock('01:00'));
    expect(ones).toHaveLength(2);
    expect(ones[0]!.style.top).not.toBe(ones[1]!.style.top);
    const paired = [...fallCompare!.children] as HTMLElement[];
    expect(paired.map((node) => node.style.top)).toEqual(fallLabels.map((node) => node.style.top));
    expect(paired.find((node) => node.style.top === ones[0]!.style.top)?.textContent).toBe(clock('08:00'));
    expect(paired.find((node) => node.style.top === ones[1]!.style.top)?.textContent).toBe(clock('09:00'));
    const second = screen.getByRole('button', { name: `Once, ${clock('01:00')} to ${clock('01:30')}` });
    expect(second.parentElement?.style.top).toBe(ones[1]!.style.top);
    expect(second.parentElement?.style.top).toBe('40%');
  });

  it('describes the grid by its zone and keeps the hour columns out of the announcement', () => {
    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Kolkata" anchor={date('2026-11-16')} events={[]} />);
    const region = calendarBoard();
    expect(described()).toEqual(['Times in PST (GMT-8). Second column GMT+5:30, 13 h 30 min ahead.']);
    for (const id of (region.getAttribute('aria-describedby') ?? '').split(' ')) {
      const label = document.getElementById(id);
      expect(label?.closest('[aria-hidden="true"]')).toBeNull();
    }
    const columns = hourColumns();
    expect(columns).toHaveLength(2);
    for (const column of columns) expect(column.getAttribute('aria-hidden')).toBe('true');
    const announced = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
      if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true') return '';
      return [...node.childNodes].map((child) => announced(child)).join('');
    };
    const heard = announced(region);
    expect(heard).toContain('Times in PST (GMT-8)');
    expect(heard).toContain('13 h 30 min ahead');
    expect(heard).not.toContain(clock('08:00'));
    expect(heard).not.toContain('+1 day');
  });

  it('explains the zone and shows a second zone on the English and Korean pages', () => {
    render(<EventCalendarZones locale="en-US" />);
    expect(described()).toEqual(['Times in PST (GMT-8). Second column GMT+5:30, 13 h 30 min ahead.']);
    expect(hourColumns()[1]?.textContent).toContain('+1 day');
    expect(screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` })).toBeTruthy();
    cleanup();

    render(<EventCalendarZones locale="ko" />);
    expect(described()).toEqual(['시각은 GMT-8입니다. 둘째 열은 GMT+5:30이며, 13시간 30분 빠릅니다.']);
    expect(hourColumns()[1]?.textContent).toContain('+1일');
    cleanup();

    const en = readFileSync(join(process.cwd(), 'app/(en)/recipes/event-calendar/page.mdx'), 'utf8');
    const ko = readFileSync(join(process.cwd(), 'app/ko/recipes/event-calendar/page.mdx'), 'utf8');
    for (const page of [en, ko]) {
      expect(page).toContain('<Example of={EventCalendarZones} />');
      expect(page).toContain('timeZone');
      expect(page).toContain('compareZone');
      expect(page).toContain('Asia/Kolkata');
      expect(page).toContain('Asia/Kathmandu');
    }
    expect(en).toContain('zone name');
    expect(en).toContain('PST / PDT');
    expect(en).toContain('5:00 PM / 6:00 PM');
    expect(en).toContain('A day shift belongs to the time it follows');
    expect(en).toContain('first visible day that uses the later offset');
    expect(en).toContain('leaves out the time difference');
    expect(en).not.toContain('every offset the visible days use');
    expect(en).not.toContain('names every zone name');
    expect(en).not.toContain('keeps a row only');
    expect(en).toContain('server-rendered app passes `timeZone` explicitly');
    expect(en).toContain('+1 day');
    expect(ko).toContain('PST / PDT');
    expect(ko).toContain('오후 5:00 / 오후 6:00');
    expect(ko).toContain('날짜 차이는 바로 앞의 시각에 속합니다');
    expect(ko).not.toContain('5:00 PM / 6:00 PM');
    expect(ko).toContain('첫 보이는 날');
    expect(ko).toContain('시차를 적지 않습니다');
    expect(ko).not.toContain('같은 규칙일 때만');
    expect(ko).toContain('서버에서 그리는 앱은 `timeZone`을 직접 넘깁니다');
    expect(ko).toContain('+1일');
  });
});

function compareRow(top: string): string | undefined {
  const column = document.querySelector<HTMLElement>('[data-compare]');
  return ([...(column?.children ?? [])] as HTMLElement[]).find((node) => node.style.top === top)?.textContent;
}

function weekDays(anchor: string): Temporal.PlainDate[] {
  const day = Temporal.PlainDate.from(anchor);
  const sunday = day.subtract({ days: day.dayOfWeek % 7 });
  return Array.from({ length: 7 }, (_, index) => sunday.add({ days: index }));
}

function compareLabel(grid: string, compare: string, days: readonly Temporal.PlainDate[], wall: string, locale: string): string {
  const seen = new Map<string, { time: string; shift: number }>();
  for (const day of days) {
    const at = day.toZonedDateTime({ timeZone: grid, plainTime: Temporal.PlainTime.from(wall) });
    const there = at.withTimeZone(compare);
    const offset = new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: compare, timeZoneName: 'shortOffset' })
      .formatToParts(at.epochMilliseconds)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (!offset || seen.has(offset)) continue;
    seen.set(offset, { time: formatTime(there.toPlainTime(), { locale }), shift: at.toPlainDate().until(there.toPlainDate(), { largestUnit: 'day' }).days });
  }
  const parts = [...seen.values()];
  const shiftLabel = (days: number) => {
    if (days === 0) return '';
    const count = new Intl.NumberFormat(locale, { signDisplay: 'always', maximumFractionDigits: 0 }).format(days);
    const unit = new Intl.DisplayNames(locale, { type: 'dateTimeField', style: 'narrow' }).of('day') ?? 'day';
    const space = /\p{Script=Hangul}/u.test(unit) ? '' : ' ';
    return `${count}${space}${unit}`;
  };
  return parts.map((part) => (part.shift === 0 ? part.time : `${part.time} ${shiftLabel(part.shift)}`)).join(' / ');
}

describe('a zone whose offset changes inside the visible week', () => {
  it('lists both second-zone times when the compare zone changes midweek', () => {
    // Israel springs forward Fri 27 Mar 2026. 8:00 PDT is 17:00 Jerusalem Sun-Thu, 18:00 Fri-Sat.
    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Jerusalem" anchor={Temporal.PlainDate.from('2026-03-22')} events={[]} />);
    const days = weekDays('2026-03-22');
    const primary = hourColumns()[0];
    const eight = [...primary!.children].find((node) => node.textContent === '8:00 AM') as HTMLElement;
    expect(compareRow(eight.style.top)).toBe('5:00 PM / 6:00 PM');
    const two = [...primary!.children].find((node) => node.textContent === '2:00 PM') as HTMLElement;
    expect(compareRow(two.style.top)).toBe('11:00 PM / 12:00 AM +1 day');
    expect(compareRow(eight.style.top)).toBe(compareLabel(LA, 'Asia/Jerusalem', days, '08:00', 'en-US'));
    expect(screen.getByText(cornerText('GMT+2 / GMT+3'))).toBeTruthy();
    const thursday = screen.getByRole('heading', { name: 'Thu, Mar 26 · Second column GMT+3 begins' });
    expect(thursday.getAttribute('aria-describedby')).toBeNull();
    expect(thursday.querySelector('[aria-hidden]')).toBeNull();
    const head = thursday.parentElement!;
    for (const child of head.children) {
      if (child.tagName === 'H3') continue;
      expect(child.textContent ?? '').not.toContain('begins');
    }
    const marked = [...head.querySelectorAll('h3')].filter((heading) => (heading.textContent ?? '').includes('begins'));
    expect(marked.map((heading) => heading.textContent)).toEqual(['Thu, Mar 26 · Second column GMT+3 begins']);
  });

  it('lists both second-zone times when the grid zone changes and the second zone does not', () => {
    render(
      <EventCalendarExample
        locale="en-US"
        timeZone={LA}
        compareZone="UTC"
        anchor={Temporal.PlainDate.from('2027-03-14')}
        opens={Temporal.PlainTime.from('00:00')}
        closes={Temporal.PlainTime.from('04:00')}
        events={[]}
      />,
    );
    const primary = hourColumns()[0];
    const midnight = [...primary!.children].find((node) => node.textContent === '12:00 AM') as HTMLElement;
    expect(compareRow(midnight.style.top)).toBe('8:00 AM / 7:00 AM');
    const sunday = screen.getByRole('heading', { name: 'Sun, Mar 14 · PDT begins' });
    expect(sunday.textContent).toBe('Sun, Mar 14 · PDT begins');
    expect(sunday.getAttribute('aria-describedby')).toBeNull();
  });

  it('keeps every hour of a Sydney week beside Los Angeles, and each time matches the days that use it', () => {
    render(<EventCalendarExample locale="en-US" timeZone="Australia/Sydney" compareZone={LA} anchor={Temporal.PlainDate.from('2026-03-08')} events={[]} />);
    const days = weekDays('2026-03-08');
    const [primary, compare] = hourColumns();
    const rows = [...compare!.children] as HTMLElement[];
    expect(rows).toHaveLength(10);
    const walls = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    for (const row of rows) {
      const hour = ([...primary!.children] as HTMLElement[]).find((node) => node.style.top === row.style.top);
      const wall = walls.find((value) => clock(value) === hour?.textContent);
      expect(wall).toBeTruthy();
      expect(row.textContent).toBe(compareLabel('Australia/Sydney', LA, days, wall!, 'en-US'));
    }
    const eight = ([...primary!.children] as HTMLElement[]).find((node) => node.textContent === '8:00 AM') as HTMLElement;
    expect(compareRow(eight.style.top)).toBe('1:00 PM -1 day / 2:00 PM -1 day');
    const monday = screen.getByRole('heading', { name: 'Mon, Mar 9 · Second column PDT begins' });
    expect(monday.textContent).toBe('Mon, Mar 9 · Second column PDT begins');
    const head = monday.parentElement!;
    for (const child of head.children) {
      if (child.tagName === 'H3') continue;
      expect(child.textContent ?? '').not.toContain('begins');
      expect(child.textContent ?? '').not.toContain('Second column');
    }
    const marked = [...head.querySelectorAll('h3')].filter((heading) => (heading.textContent ?? '').includes('begins'));
    expect(marked.map((heading) => heading.textContent)).toEqual(['Mon, Mar 9 · Second column PDT begins']);
  });

  it('does not describe a midweek change as one lead, in English or Korean', () => {
    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Jerusalem" anchor={Temporal.PlainDate.from('2026-03-22')} events={[]} />);
    expect(described()).toEqual(['Times in PDT (GMT-7). Second column GMT+2 / GMT+3.']);
    cleanup();
    render(<EventCalendarExample locale="ko" timeZone={LA} compareZone="Asia/Jerusalem" anchor={Temporal.PlainDate.from('2026-03-22')} events={[]} />);
    expect(described()).toEqual(['시각은 GMT-7입니다. 둘째 열은 GMT+2 / GMT+3입니다.']);
    const changed = screen.getByRole('heading', { name: /둘째 열 GMT\+3 시작/ });
    expect(changed.textContent).toContain('3월 26일');
    expect(changed.textContent).toContain('둘째 열 GMT+3 시작');
    expect(changed.getAttribute('aria-describedby')).toBeNull();
  });

  it('names every offset the week shows, not only Sunday’s', () => {
    render(
      <EventCalendarExample
        locale="en-US"
        timeZone={LA}
        anchor={Temporal.PlainDate.from('2027-03-14')}
        opens={Temporal.PlainTime.from('00:00')}
        closes={Temporal.PlainTime.from('04:00')}
        events={[]}
      />,
    );
    expect(described().join(' ')).toContain('PDT');
    expect(screen.getByText(cornerText('PST / PDT'))).toBeTruthy();
  });

  it('shows one second-zone time on every row when that zone keeps one offset', () => {
    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Kolkata" anchor={date('2026-11-16')} events={[]} />);
    const [primary, compare] = hourColumns();
    const days = Array.from({ length: 7 }, (_, index) => Temporal.PlainDate.from('2026-11-15').add({ days: index }));
    const rows = [...compare!.children] as HTMLElement[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const hour = ([...primary!.children] as HTMLElement[]).find((node) => node.style.top === row.style.top);
      const wall = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].find((value) => clock(value) === hour?.textContent);
      expect(wall).toBeTruthy();
      const texts = days.map((day) => {
        const at = day.toZonedDateTime({ timeZone: LA, plainTime: Temporal.PlainTime.from(wall!) });
        const there = at.withTimeZone('Asia/Kolkata');
        const shift = at.toPlainDate().until(there.toPlainDate(), { largestUnit: 'day' }).days;
        const label = formatTime(there.toPlainTime(), { locale: 'en-US' });
        return shift === 0 ? label : `${label} ${shift > 0 ? '+' : ''}${shift} day`;
      });
      expect(new Set(texts).size).toBe(1);
      expect(row.textContent).toBe(texts[0]);
    }
  });
});

describe('repeating events', () => {
  afterEach(cleanup);

  it('places Book club on the Sunday hour beside the second zone', () => {
    render(<EventCalendarExample locale="en-US" timeZone={LA} compareZone="Asia/Kolkata" anchor={date('2026-11-16')} />);
    const club = screen.getByRole('button', { name: `Book club, ${clock('15:00')} to ${clock('16:00')}, repeats` });
    const sunday = screen.getByRole('list', { name: 'Sun, Nov 15' });
    expect(sunday.contains(club)).toBe(true);
    expect(document.querySelector('[data-compare]')?.contains(club)).toBe(false);
    const [primary, compare] = hourColumns();
    const three = [...primary!.children].find((node) => node.textContent === clock('15:00')) as HTMLElement;
    expect(three).toBeTruthy();
    expect(club.parentElement?.style.top).toBe(three.style.top);
    const row = [...compare!.children].find((node) => (node as HTMLElement).style.top === three.style.top);
    expect(row?.textContent).toBe('4:30 AM +1 day');
  });

  const polite = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');
  const bookClubName = `Book club, ${clock('15:00')} to ${clock('16:00')}, repeats`;

  const openMenu = async () => {
    let menu: HTMLElement | undefined;
    await vi.waitFor(() => {
      menu = screen.getAllByRole('menu', { hidden: true }).find((each) => each.hasAttribute('data-popover-open'));
      expect(menu).toBeDefined();
    });
    return menu!;
  };

  async function choose(name: string, item: string) {
    const trigger = screen.getByRole('button', { name });
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.click(trigger);
    });
    const menu = await openMenu();
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: item }));
    });
  }

  function dismiss() {
    document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
  }

  it('shows each occurrence in the week, the day, and the month, and says that it repeats', () => {
    render(<EventCalendarExample locale="en-US" />);
    const club = screen.getByRole('button', { name: bookClubName });
    const mark = club.querySelector('[title="Repeats"]');
    expect(mark?.textContent).toBe('↻');
    expect(mark?.checkVisibility()).toBe(true);
    expect(screen.getByRole('list', { name: 'Sun, Nov 15' }).contains(club)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(screen.getByRole('list', { name: 'Sun, Nov 15' }).contains(screen.getByRole('button', { name: bookClubName }))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('list', { name: 'Sun, Nov 22' }).contains(screen.getByRole('button', { name: bookClubName }))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(describedBy('Sunday, November 15, 2026')).toBe('Book club, repeats');
    expect(describedBy('Sunday, November 22, 2026')).toContain('Book club, repeats');
    expect(describedBy('Sunday, November 8, 2026')).toBe('');
  });

  it('saves a weekly series on the chosen days and stops after the chosen count', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Reading' } });
    const repeat = within(dialog).getByLabelText('Repeat') as HTMLSelectElement;
    expect([...repeat.options].map((option) => option.text)).toEqual(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly']);
    fireEvent.change(repeat, { target: { value: 'WEEKLY' } });
    const days = within(dialog).getByRole('group', { name: 'Days' });
    expect(within(days).getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(days).getByRole('button', { name: 'Wed' }));
    expect(within(dialog).getByRole('radio', { name: 'Never' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'On' }));
    expect(within(dialog).getByRole('textbox', { name: 'Last date' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'After' }));
    const times = within(dialog).getByRole('spinbutton', { name: 'Times' });
    fireEvent.change(times, { target: { value: '2' } });
    fireEvent.blur(times);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const reading = `Reading, ${clock('08:00')} to ${clock('08:15')}, repeats`;
    const onDay = (day: string) => within(screen.getByRole('list', { name: day })).getByRole('button', { name: reading });
    expect(onDay('Mon, Nov 16').textContent).toMatch(/Repeats/);
    expect(onDay('Wed, Nov 18')).toBeTruthy();
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Added /));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.queryByRole('button', { name: reading })).toBeNull();
  });

  it('stops a weekly series on the chosen last date', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Reading' } });
    fireEvent.change(within(dialog).getByLabelText('Repeat'), { target: { value: 'WEEKLY' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'On' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Last date' }), { target: { value: '11/23/2026' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const reading = `Reading, ${clock('08:00')} to ${clock('08:15')}, repeats`;
    expect(screen.getByRole('list', { name: 'Mon, Nov 16' }).contains(screen.getByRole('button', { name: reading }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('list', { name: 'Mon, Nov 23' }).contains(screen.getByRole('button', { name: reading }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.queryByRole('button', { name: reading })).toBeNull();
  });

  it('asks which events to change, and a change to this event leaves the later ones', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const club = screen.getByRole('button', { name: bookClubName });
    club.focus();
    await choose(bookClubName, 'Edit…');
    const choice = await screen.findByRole('dialog', { name: 'Edit repeating event' });
    expect(within(choice).getByText('This event repeats. Choose which events to edit.')).toBeTruthy();
    expect(choice.getAttribute('aria-describedby')).toBe(within(choice).getByText('This event repeats. Choose which events to edit.').id);
    const thisEvent = within(choice).getByRole('button', { name: 'This event' });
    expect(within(choice).getByRole('button', { name: 'This and following' })).toBeTruthy();
    expect(within(choice).getByRole('button', { name: 'All events' })).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(thisEvent));
    dismiss();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: bookClubName }));

    await choose(bookClubName, 'Edit…');
    const again = await screen.findByRole('dialog', { name: 'Edit repeating event' });
    fireEvent.click(within(again).getByRole('button', { name: 'This event' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Book club' });
    expect(within(form).queryByLabelText('Repeat')).toBeNull();
    fireEvent.change(within(form).getByRole('textbox', { name: 'Title' }), { target: { value: 'Poetry' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const poetry = `Poetry, ${clock('15:00')} to ${clock('16:00')}, repeats`;
    expect(screen.getByRole('list', { name: 'Sun, Nov 15' }).contains(screen.getByRole('button', { name: poetry }))).toBe(true);
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Changed this event\./));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('list', { name: 'Sun, Nov 22' }).contains(screen.getByRole('button', { name: bookClubName }))).toBe(true);
  });

  it('stays on the later week when all events are saved from there', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Nov 22 – Nov 28, 2026')).toBeTruthy();
    await choose(bookClubName, 'Edit…');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit repeating event' })).getByRole('button', { name: 'All events' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Book club' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Title' }), { target: { value: 'Readers' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Nov 22 – Nov 28, 2026')).toBeTruthy();
    const readers = `Readers, ${clock('15:00')} to ${clock('16:00')}, repeats`;
    expect(within(screen.getByRole('list', { name: 'Sun, Nov 22' })).getByRole('button', { name: readers })).toBeTruthy();
  });

  async function editAllFromNextWeek() {
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(bookClubName, 'Edit…');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit repeating event' })).getByRole('button', { name: 'All events' }));
    return screen.findByRole('dialog', { name: 'Edit Book club' });
  }

  it('returns focus to the Nov 22 strip bar when all events become all day, and restores 3:00 PM when they are timed again', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const form = await editAllFromNextWeek();
    fireEvent.click(within(form).getByRole('switch', { name: 'All day' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const bar = screen.getByRole('button', { name: 'Book club, November 22, 2026, repeats' });
    expect(screen.getByText('Nov 22 – Nov 28, 2026')).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(bar));

    await choose('Book club, November 22, 2026, repeats', 'Edit…');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit repeating event' })).getByRole('button', { name: 'All events' }));
    const again = await screen.findByRole('dialog', { name: 'Edit Book club' });
    fireEvent.click(within(again).getByRole('switch', { name: 'All day' }));
    fireEvent.click(within(again).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Nov 22 – Nov 28, 2026')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Sun, Nov 22' })).getByRole('button', { name: bookClubName })).toBeTruthy();
  });

  it('keeps Nov 22 and focuses the 5:00 PM block when all events start then', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const form = await editAllFromNextWeek();
    fireEvent.change(within(form).getByRole('textbox', { name: 'Start' }), { target: { value: '5:00 PM' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const moved = `Book club, ${clock('17:00')} to ${clock('18:00')}, repeats`;
    const block = within(screen.getByRole('list', { name: 'Sun, Nov 22' })).getByRole('button', { name: moved });
    expect(screen.getByText('Nov 22 – Nov 28, 2026')).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(block));
  });

  it('moves to the week of the new date when all events leave the week on screen', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const form = await editAllFromNextWeek();
    const date = within(form).getByRole('textbox', { name: 'Date' });
    fireEvent.change(date, { target: { value: '11/29/2026' } });
    fireEvent.blur(date);
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Nov 29 – Dec 5, 2026')).toBeTruthy();
    const block = within(screen.getByRole('list', { name: 'Sun, Nov 29' })).getByRole('button', { name: bookClubName });
    await vi.waitFor(() => expect(document.activeElement).toBe(block));
  });

  it('changes every occurrence when the edit applies to all events', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(bookClubName, 'Edit…');
    const choice = await screen.findByRole('dialog', { name: 'Edit repeating event' });
    fireEvent.click(within(choice).getByRole('button', { name: 'All events' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Book club' });
    expect((within(form).getByLabelText('Repeat') as HTMLSelectElement).value).toBe('WEEKLY');
    fireEvent.change(within(form).getByRole('textbox', { name: 'Title' }), { target: { value: 'Readers' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const readers = `Readers, ${clock('15:00')} to ${clock('16:00')}, repeats`;
    expect(screen.getByRole('button', { name: readers })).toBeTruthy();
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Changed all events\./));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('button', { name: readers })).toBeTruthy();
  });

  it('splits this and the following occurrences onto a new series', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(bookClubName, 'Edit…');
    const choice = await screen.findByRole('dialog', { name: 'Edit repeating event' });
    fireEvent.click(within(choice).getByRole('button', { name: 'This and following' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Book club' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Title' }), { target: { value: 'Later' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const later = `Later, ${clock('15:00')} to ${clock('16:00')}, repeats`;
    expect(screen.getByRole('list', { name: 'Sun, Nov 22' }).contains(screen.getByRole('button', { name: later }))).toBe(true);
    expect(screen.queryByRole('button', { name: bookClubName })).toBeNull();
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Changed this and following events\./));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('button', { name: later })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByRole('list', { name: 'Sun, Nov 15' }).contains(screen.getByRole('button', { name: bookClubName }))).toBe(true);
  });

  it('removes one occurrence, or the rest of the series, and says which', async () => {
    render(<EventCalendarExample locale="en-US" />);
    await choose(bookClubName, 'Delete');
    const choice = await screen.findByRole('dialog', { name: 'Delete repeating event' });
    expect(within(choice).getByText('This event repeats. Choose which events to delete.')).toBeTruthy();
    expect(choice.getAttribute('aria-describedby')).toBe(within(choice).getByText('This event repeats. Choose which events to delete.').id);
    const thisEvent = within(choice).getByRole('button', { name: 'This event' });
    await vi.waitFor(() => expect(document.activeElement).toBe(thisEvent));
    dismiss();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: bookClubName }));

    await choose(bookClubName, 'Delete');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete repeating event' })).getByRole('button', { name: 'This event' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: bookClubName })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Sun, Nov 15' }));
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Deleted this event\./));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('button', { name: bookClubName })).toBeTruthy();

    await choose(bookClubName, 'Delete');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete repeating event' })).getByRole('button', { name: 'All events' }));
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: bookClubName })).toBeNull());
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Deleted all events\./));
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.queryByRole('button', { name: bookClubName })).toBeNull();
  });

  it('keeps a weekly series on the date’s weekday', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Reading' } });
    fireEvent.change(within(dialog).getByLabelText('Repeat'), { target: { value: 'WEEKLY' } });
    const days = within(dialog).getByRole('group', { name: 'Days' });
    expect(within(days).getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('true');
    const daysLabel = document.getElementById(within(dialog).getByLabelText('Days').getAttribute('aria-labelledby') ?? '');
    const endsLabel = document.getElementById(within(dialog).getByLabelText('Ends').getAttribute('aria-labelledby') ?? '');
    expect(daysLabel?.textContent).toBe('Days');
    expect(endsLabel?.textContent).toBe('Ends');
    expect(daysLabel?.checkVisibility()).toBe(true);
    expect(endsLabel?.checkVisibility()).toBe(true);
    const date = within(dialog).getByRole('textbox', { name: 'Date' });
    fireEvent.change(date, { target: { value: '11/19/2026' } });
    fireEvent.blur(date);
    expect(within(days).getByRole('button', { name: 'Thu' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(days).getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const reading = `Reading, ${clock('08:00')} to ${clock('08:15')}, repeats`;
    expect(within(screen.getByRole('list', { name: 'Thu, Nov 19' })).getByRole('button', { name: reading })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Mon, Nov 16' })).queryByRole('button', { name: reading })).toBeNull();
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Added /));
  });

  it('refuses a weekly series whose days leave out the start', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Reading' } });
    fireEvent.change(within(dialog).getByLabelText('Repeat'), { target: { value: 'WEEKLY' } });
    const days = within(dialog).getByRole('group', { name: 'Days' });
    fireEvent.click(within(days).getByRole('button', { name: 'Wed' }));
    fireEvent.click(within(days).getByRole('button', { name: 'Mon' }));
    const date = within(dialog).getByRole('textbox', { name: 'Date' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(date.getAttribute('aria-invalid')).toBe('true'));
    expect(document.activeElement).toBe(date);
    expect(within(dialog).getByLabelText('Repeat').getAttribute('aria-invalid')).not.toBe('true');
    const described = date.getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(described).toContain('The start day has to be one of the weekly days.');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Reading,/ })).toBeNull();
  });

  it('moves a one-weekday series onto the new date and keeps a deleted occurrence deleted', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(bookClubName, 'Delete');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete repeating event' })).getByRole('button', { name: 'This event' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await choose(bookClubName, 'Edit…');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit repeating event' })).getByRole('button', { name: 'All events' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Book club' });
    expect((within(form).getByLabelText('Repeat') as HTMLSelectElement).value).toBe('WEEKLY');
    expect(within(form).getByRole('group', { name: 'Days' }).querySelector('[aria-pressed="true"]')?.textContent).toBe('Sun');
    const date = within(form).getByRole('textbox', { name: 'Date' });
    fireEvent.change(date, { target: { value: '11/16/2026' } });
    fireEvent.blur(date);
    expect(within(form).getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const moved = `Book club, ${clock('15:00')} to ${clock('16:00')}, repeats`;
    expect(within(screen.getByRole('list', { name: 'Mon, Nov 16' })).getByRole('button', { name: moved })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Sun, Nov 15' })).queryByRole('button', { name: moved })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(within(screen.getByRole('list', { name: 'Sun, Nov 22' })).queryByRole('button', { name: moved })).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Mon, Nov 23' })).queryByRole('button', { name: moved })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(within(screen.getByRole('list', { name: 'Mon, Nov 30' })).getByRole('button', { name: moved })).toBeTruthy();
  });

  it('names an all-day repeating bar with repeats', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Holiday' } });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'All day' }));
    fireEvent.change(within(dialog).getByLabelText('Repeat'), { target: { value: 'WEEKLY' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const holiday = screen.getByRole('button', { name: 'Holiday, November 16, 2026, repeats' });
    const cue = within(holiday).getByText('Repeats');
    expect(cue.checkVisibility()).toBe(true);
    expect(cue.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('loads the series start and its weekdays when a later occurrence edits all events', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(bookClubName, 'Edit…');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit repeating event' })).getByRole('button', { name: 'All events' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Book club' });
    expect((within(form).getByRole('textbox', { name: 'Date' }) as HTMLInputElement).value).toBe('11/15/2026');
    expect(within(form).getByRole('button', { name: 'Sun' }).getAttribute('aria-pressed')).toBe('true');
    expect((within(form).getByLabelText('Repeat') as HTMLSelectElement).value).toBe('WEEKLY');
  });

  it('stops this and the following occurrences where the old count stopped', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Reading' } });
    fireEvent.change(within(dialog).getByLabelText('Repeat'), { target: { value: 'WEEKLY' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'After' }));
    const times = within(dialog).getByRole('spinbutton', { name: 'Times' });
    fireEvent.change(times, { target: { value: '4' } });
    fireEvent.blur(times);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const reading = `Reading, ${clock('08:00')} to ${clock('08:15')}, repeats`;
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(reading, 'Edit…');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit repeating event' })).getByRole('button', { name: 'This and following' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Reading' });
    expect((within(form).getByRole('spinbutton', { name: 'Times' }) as HTMLInputElement).value).toBe('3');
    fireEvent.change(within(form).getByRole('textbox', { name: 'Title' }), { target: { value: 'Later' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const later = `Later, ${clock('08:00')} to ${clock('08:15')}, repeats`;
    expect(within(screen.getByRole('list', { name: 'Mon, Nov 23' })).queryByRole('button', { name: reading })).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Mon, Nov 23' })).getByRole('button', { name: later })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('button', { name: later })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('button', { name: later })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.queryByRole('button', { name: later })).toBeNull();
    expect(screen.queryByRole('button', { name: reading })).toBeNull();
  });

  it('deletes this and the following occurrences, and names the date', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(bookClubName, 'Delete');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete repeating event' })).getByRole('button', { name: 'This and following' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: bookClubName })).toBeNull();
    await vi.waitFor(() => expect(polite()?.textContent).toBe('Deleted this and following events. Book club, Sun, Nov 22.'));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.queryByRole('button', { name: bookClubName })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(within(screen.getByRole('list', { name: 'Sun, Nov 15' })).getByRole('button', { name: bookClubName })).toBeTruthy();
  });

  it('names the date when one occurrence is deleted, in English and Korean', async () => {
    render(<EventCalendarExample locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await choose(bookClubName, 'Delete');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete repeating event' })).getByRole('button', { name: 'This event' }));
    await vi.waitFor(() => expect(polite()?.textContent).toBe('Deleted this event. Book club, Sun, Nov 22.'));
    cleanup();
    render(<EventCalendarExample locale="ko" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    const club = screen.getByRole('button', { name: /^Book club,/ });
    await act(async () => {
      fireEvent.pointerDown(club, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.pointerUp(club, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.click(club);
    });
    const menu = await openMenu();
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    });
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete repeating event' })).getByRole('button', { name: 'This event' }));
    await vi.waitFor(() => expect(polite()?.textContent).toBe('Deleted this event. Book club, 11월 22일 (일).'));
  });

  it('deleting a single event names its date', async () => {
    render(<EventCalendarExample locale="en-US" />);
    const trigger = screen.getAllByRole('button', { name: /^Planning, / })[0]!;
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
      fireEvent.click(trigger);
    });
    let menu: HTMLElement | undefined;
    await vi.waitFor(() => {
      menu = screen.getAllByRole('menu', { hidden: true }).find((each) => each.hasAttribute('data-popover-open'));
      expect(menu).toBeDefined();
    });
    await act(async () => fireEvent.click(within(menu!).getByRole('menuitem', { name: 'Delete' })));
    await vi.waitFor(() => expect(polite()?.textContent).toMatch(/^Deleted Planning, Thu, Nov 19\.$/));
  });
});
