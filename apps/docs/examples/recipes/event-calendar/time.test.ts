import { describe, expect, it } from 'vitest';
import { daySegments, findConflicts, fromUnits, snapGrid, toUnits, type CalendarEvent, type DaySegment } from './time';

const date = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);
const at = (text: string) => Temporal.ZonedDateTime.from(text);

const LA = 'America/Los_Angeles';
const SPRING = date('2027-03-14');
const FALL = date('2027-11-07');

function event(id: string, start: string, end: string, extra: Partial<Pick<CalendarEvent, 'seriesId' | 'allDay'>> = {}): CalendarEvent {
  return { id, start: at(start), end: at(end), allDay: false, ...extra };
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
