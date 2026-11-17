// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatTime } from '@tounsoo/todae';
import EventCalendarExample, {
  daySegments,
  findConflicts,
  fromUnits,
  hourMarks,
  laneScale,
  placeOverlaps,
  snapGrid,
  spanFrame,
  toUnits,
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
      ['point', 0.5, 0.5],
      ['long', 0, 1],
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

  it('returns the Monday-to-Sunday week that contains a day', () => {
    expect(weekOf(date('2026-11-17')).map((day) => day.toString())).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(weekOf(date('2026-11-22')).map((day) => day.toString())[0]).toBe('2026-11-16');
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
    expect(screen.queryByRole('button', { name: /Offsite/ })).toBeNull();

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

  it('keeps a fall-back week’s hours on the day they belong to', () => {
    const zone = 'America/Los_Angeles';
    const monday = Temporal.PlainDate.from('2026-10-26');
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
            start: Temporal.PlainDateTime.from('2026-10-26T03:00').toZonedDateTime(zone),
            end: Temporal.PlainDateTime.from('2026-10-26T03:30').toZonedDateTime(zone),
            allDay: false,
          },
        ]}
      />,
    );

    const mondayColumn = screen.getByRole('list', { name: 'Mon, Oct 26' }).parentElement;
    const three = [...(mondayColumn?.querySelectorAll('span') ?? [])].find((node) => node.textContent === '3:00 AM');
    const event = screen.getByRole('button', { name: /Night check/ });
    expect(three).toBeTruthy();
    expect(event.parentElement?.style.top).toBe((three as HTMLElement).style.top);

    const board = event.closest('[aria-label="Calendar"]');
    const oneAm = [...(board?.querySelectorAll('span') ?? [])].filter((node) => node.textContent === '1:00 AM');
    expect(oneAm).toHaveLength(2);
    const sundayColumn = screen.getByRole('list', { name: 'Sun, Nov 1' }).parentElement;
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

  it('names a week in the page locale with one dash', () => {
    render(<EventCalendarExample locale="en-US" />);
    expect(screen.getByText('Nov 16 – Nov 22, 2026')).toBeTruthy();
    cleanup();
    render(<EventCalendarExample locale="ko-KR" />);
    expect(screen.getByText('11월 16일 – 2026년 11월 22일')).toBeTruthy();
  });

  it('names an event in the calendar zone and places it on that day', () => {
    render(
      <EventCalendarExample
        locale="en-US"
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
    const tracks = head.style.gridTemplateColumns.match(/minmax\(max\(5\.5rem, \d+ \* 4rem\), 1fr\)/g);
    expect(tracks).toEqual([
      'minmax(max(5.5rem, 2 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 3 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
      'minmax(max(5.5rem, 1 * 4rem), 1fr)',
    ]);
    expect(body.style.gridTemplateColumns).toBe(head.style.gridTemplateColumns);
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
