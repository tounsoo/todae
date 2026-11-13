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
  verdictFor,
} from '../../examples/recipes/conference-schedule/ConferenceSchedule';
import type { Talk } from '../../examples/recipes/conference-schedule/ConferenceSchedule';

const date = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);
const at = (text: string, zone: string) => Temporal.PlainDateTime.from(text).toZonedDateTime(zone);

describe('time axis', () => {
  const zone = 'America/Los_Angeles';
  const axis = timeline({ days: [date('2027-06-02'), date('2027-06-03')], opens: time('09:00'), closes: time('18:00'), timeZone: zone });

  it('counts open minutes only, so the nights drop out', () => {
    expect(axis.range).toEqual({ start: 0, end: 1080 });
    expect(axis.segments.map(({ start, end }) => [start, end])).toEqual([
      [0, 540],
      [540, 1080],
    ]);
    expect(toUnits(axis, at('2027-06-03T10:15', zone))).toBe(615);
    expect(toUnits(axis, at('2027-06-02T20:00', zone))).toBeNull();
    expect(fromUnits(axis, 615)!.toPlainDateTime().toString()).toBe('2027-06-03T10:15:00');
  });

  it('puts the point where one day closes and the next opens in the day the edge belongs to', () => {
    expect(fromUnits(axis, 540, 'start')!.toPlainDateTime().toString()).toBe('2027-06-03T09:00:00');
    expect(fromUnits(axis, 540, 'end')!.toPlainDateTime().toString()).toBe('2027-06-02T18:00:00');
    expect(segmentAt(axis, 540, 'start')!.day.toString()).toBe('2027-06-03');
    expect(segmentAt(axis, 540, 'end')!.day.toString()).toBe('2027-06-02');
    expect(toUnits(axis, at('2027-06-02T18:00', zone), 'end')).toBe(540);
    expect(toUnits(axis, at('2027-06-02T18:00', zone), 'start')).toBeNull();
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

describe('verdictFor', () => {
  const zone = 'America/Los_Angeles';
  const talk = (id: string, from: string, to: string): Talk => ({
    id,
    title: id,
    speakers: [id],
    track: 'Design',
    format: 'Talk',
    length: 30,
    audience: 10,
    recorded: true,
    at: { stage: 'hall', starts: Temporal.PlainDateTime.from(from).toZonedDateTime(zone), ends: Temporal.PlainDateTime.from(to).toZonedDateTime(zone) },
  });
  const talks = (from: string, to: string) => [talk('earlier', from, to), { ...talk('moved', from, to), at: null }];

  it('counts a changeover only within a day, though the axis leaves the night out', () => {
    // 18:00 on day 1 and 9:00 on day 2 are both 540 on the axis.
    expect(verdictFor(talks('2027-06-02T17:15', '2027-06-02T18:00'), 'moved', { lane: 'hall', start: 540, end: 570 })).toBeNull();
    // 9:30 to 9:35 on day 2 is too short to change over.
    expect(verdictFor(talks('2027-06-03T09:00', '2027-06-03T09:30'), 'moved', { lane: 'hall', start: 575, end: 605 })).toEqual({ level: 'warning', reason: 'Under 10 minutes from earlier', with: ['earlier'] });
  });

  it('marks the talks a blocked place overlaps, even when a closed window is the reason', () => {
    // Lunch on day 1 runs 12:30 to 13:30. 12:00 to 13:00 is units 180 to 240, over 11:30 to 12:15.
    const verdict = verdictFor(talks('2027-06-02T11:30', '2027-06-02T12:15'), 'moved', { lane: 'hall', start: 180, end: 240 });
    expect(verdict).toEqual({ level: 'blocked', reason: 'Overlaps Lunch', with: ['earlier'] });
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

  it('marks a picked speaker’s talks and lets the rest recede', () => {
    setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Highlight speaker' }), { target: { value: 'Kenji Sato' } });
    const highlight = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title},`) }).closest('li')!.getAttribute('data-highlight');
    expect(highlight('Tokens that travel')).toBe('picked');
    expect(highlight('Migrating to 1\\.0')).toBe('picked');
    expect(highlight('Motion with purpose')).toBe('dimmed');
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
    // Kenji Sato's Tokens that travel would overlap Hands-on theming in the workshop room.
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
    // The opening keynote holds 9:00 to 10:00, and Tokens that travel runs 10:15 to 11:00, so 11:00 is
    // allowed but leaves no time to change over. 11:15 is the first time with no warning.
    expect(screen.getByRole('button', { name: /^Dark mode, done right,/ }).getAttribute('aria-label')).toBe('Dark mode, done right, Mira Patel, Design, Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(talksOn('Main stage')).not.toContain('Dark mode, done right');
    await vi.waitFor(() => expect(politeRegion()?.textContent).toBe('Undid: Dark mode, done right moved to Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM'));
  });
});
