// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConferenceSchedule, {
  findConflicts,
  fromUnits,
  segmentAt,
  snapGrid,
  timeline,
  toUnits,
  type Timeline,
} from '../../examples/recipes/conference-schedule/ConferenceSchedule';

const date = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);
const at = (axis: Timeline, text: string, zone: string) => Temporal.PlainDateTime.from(text).toZonedDateTime(zone);

describe('time axis', () => {
  const zone = 'America/Los_Angeles';
  const axis = timeline({ days: [date('2027-06-02'), date('2027-06-03')], opens: time('09:00'), closes: time('18:00'), timeZone: zone });

  it('counts open minutes only, so the nights drop out', () => {
    expect(axis.range).toEqual({ start: 0, end: 1080 });
    expect(axis.segments.map(({ start, end }) => [start, end])).toEqual([
      [0, 540],
      [540, 1080],
    ]);
    expect(toUnits(axis, at(axis, '2027-06-03T10:15', zone))).toBe(615);
    expect(toUnits(axis, at(axis, '2027-06-02T20:00', zone))).toBeNull();
    expect(fromUnits(axis, 615)!.toPlainDateTime().toString()).toBe('2027-06-03T10:15:00');
  });

  it('puts the point where one day closes and the next opens in the day the edge belongs to', () => {
    expect(fromUnits(axis, 540, 'start')!.toPlainDateTime().toString()).toBe('2027-06-03T09:00:00');
    expect(fromUnits(axis, 540, 'end')!.toPlainDateTime().toString()).toBe('2027-06-02T18:00:00');
    expect(segmentAt(axis, 540, 'start')!.day.toString()).toBe('2027-06-03');
    expect(segmentAt(axis, 540, 'end')!.day.toString()).toBe('2027-06-02');
    expect(toUnits(axis, at(axis, '2027-06-02T18:00', zone), 'end')).toBe(540);
    expect(toUnits(axis, at(axis, '2027-06-02T18:00', zone), 'start')).toBeNull();
  });

  it('snaps to each step from every opening, and to each closing', () => {
    expect(snapGrid(axis, 240)).toEqual([0, 240, 480, 540, 780, 1020, 1080]);
  });

  it('keeps elapsed minutes on a day the clock changes', () => {
    // Clocks in Los Angeles go back at 2:00 on 7 November 2027, so 0:00 to 4:00 lasts five hours.
    const night = timeline({ days: [date('2027-11-07')], opens: time('00:00'), closes: time('04:00'), timeZone: zone });
    expect(night.range.end).toBe(300);
    expect(fromUnits(night, 120)!.toString()).toBe('2027-11-07T01:00:00-08:00[America/Los_Angeles]');
    // And spring forward on 14 March 2027 skips 2:00 to 3:00.
    const spring = timeline({ days: [date('2027-03-14')], opens: time('00:00'), closes: time('04:00'), timeZone: zone });
    expect(spring.range.end).toBe(180);
  });

  it('works in a zone with a half-hour offset and no clock changes', () => {
    const kathmandu = timeline({ days: [date('2027-06-02')], opens: time('09:00'), closes: time('10:00'), timeZone: 'Asia/Kathmandu' });
    expect(kathmandu.segments[0]!.opens.toString()).toBe('2027-06-02T09:00:00+05:45[Asia/Kathmandu]');
    expect(kathmandu.range.end).toBe(60);
  });
});

describe('findConflicts', () => {
  const talk = { id: 'a', start: 60, end: 120, keys: ['stage:main', 'speaker:Ana'] };

  it('finds a booking that shares any key, on any stage', () => {
    const found = findConflicts(talk, [
      { id: 'b', start: 90, end: 150, keys: ['stage:hall', 'speaker:Ana'] },
      { id: 'c', start: 90, end: 150, keys: ['stage:hall', 'speaker:Kenji'] },
      { id: 'a', start: 60, end: 120, keys: ['stage:main', 'speaker:Ana'] },
    ]);
    expect(found.overlaps).toEqual([{ id: 'b', key: 'speaker:Ana' }]);
  });

  it('flags a booking closer than the buffer, and none that only touch without one', () => {
    const others = [{ id: 'b', start: 125, end: 150, keys: ['stage:main'] }];
    expect(findConflicts(talk, others, { buffer: 10 }).near).toEqual([{ id: 'b', key: 'stage:main' }]);
    expect(findConflicts(talk, others).near).toEqual([]);
  });

  it('honours windows closed to every key or to one of its keys', () => {
    const closed = [
      { start: 100, end: 130, keys: 'all' as const, reason: 'Lunch' },
      { start: 0, end: 70, keys: ['stage:workshop'], reason: 'Closed' },
      { start: 0, end: 70, keys: ['speaker:Ana'], reason: 'Away' },
    ];
    expect(findConflicts(talk, [], { closed }).shut.map((window) => window.reason)).toEqual(['Lunch', 'Away']);
  });
});

describe('the schedule', () => {
  afterEach(cleanup);
  const setup = () =>
    render(<ConferenceSchedule locale="en-US" />);
  const talksOn = (stage: string) =>
    within(within(screen.getByRole('region', { name: stage })).getByRole('list'))
      .queryAllByRole('button')
      .map((button) => TITLES.find((title) => button.getAttribute('aria-label')!.startsWith(`${title}, `)));
  const TITLES = ['Dark mode, done right', 'Tokens that travel', 'Motion with purpose', 'Auditing a design system', 'Panel: shipping 1.0', 'Writing UI copy'];
  const politeRegion = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');

  // Every menu stays in the page; jsdom marks the one that is shown.
  const openMenu = async () => {
    let menu: HTMLElement | undefined;
    await vi.waitFor(() => {
      menu = screen.getAllByRole('menu', { hidden: true }).find((each) => each.hasAttribute('data-popover-open'));
      expect(menu).toBeDefined();
    });
    return menu!;
  };

  async function choose(trigger: HTMLElement, item: string) {
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
      fireEvent.click(trigger);
    });
    const menu = await openMenu();
    const option = within(menu).getByRole('menuitem', { name: item });
    await act(async () => {
      fireEvent.click(option);
    });
  }

  it('names each talk with its speakers, stage, time and any warning', () => {
    setup();
    expect(talksOn('Main stage')).toEqual(['Tokens that travel', 'Motion with purpose', 'Auditing a design system', 'Panel: shipping 1.0', 'Writing UI copy']);
    expect(screen.getByRole('button', { name: /^Research ops at scale,/ }).getAttribute('aria-label')).toBe(
      'Research ops at scale, Priya Nair, Research, Hall B, Wed, Jun 2, 11:00 AM to 11:30 AM, warning: Expects 350, Hall B seats 300',
    );
  });

  it('moves a talk to another stage from its menu and announces it', async () => {
    setup();
    await choose(screen.getByRole('button', { name: /^Motion with purpose,/ }), 'Move to Hall B');
    expect(talksOn('Hall B')).toContain('Motion with purpose');
    expect(talksOn('Main stage')).not.toContain('Motion with purpose');
    await vi.waitFor(() => expect(politeRegion()?.textContent).toBe('Motion with purpose moved to Hall B, Wed, Jun 2, 2:00 PM to 2:40 PM. Expects 400, Hall B seats 300'));
  });

  it('marks a move that a rule blocks as unavailable', async () => {
    setup();
    // The workshop room isn't recorded, and Tokens that travel is.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Tokens that travel,/ }));
    });
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Move to Workshop room' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('schedules a talk from the queue at the first free time and undoes it', async () => {
    setup();
    await choose(screen.getByRole('button', { name: /^Dark mode, done right,/ }), 'First free time on Main stage');
    expect(talksOn('Main stage')).toContain('Dark mode, done right');
    // The opening keynote holds 9:00 to 10:00, and Tokens that travel runs 10:15 to 11:00.
    expect(screen.getByRole('button', { name: /^Dark mode, done right,/ }).getAttribute('aria-label')).toContain('Main stage, Wed, Jun 2, 11:00 AM to 11:30 AM');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(talksOn('Main stage')).not.toContain('Dark mode, done right');
    await vi.waitFor(() => expect(politeRegion()?.textContent).toBe('Undid: Dark mode, done right moved to Main stage, Wed, Jun 2, 11:00 AM to 11:30 AM'));
  });
});
