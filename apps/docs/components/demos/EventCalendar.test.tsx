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
    expect(review.parentElement?.style.top).toBe('10%');
    expect(review.parentElement?.style.height).toBe('15%');
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
});
