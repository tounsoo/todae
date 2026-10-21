import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { startTransition, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calendar, type CalendarRootProps, type DateRange } from '../index.js';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);
const grid = () => screen.getByRole('grid');
const focusedDay = () => grid().querySelector<HTMLButtonElement>('[tabindex="0"]')!;
const day = (name: string) => screen.getByRole('button', { name });

function RangeControlled({
  initial = null,
  onValueChange,
  ...props
}: { initial?: DateRange | null } & Omit<Extract<CalendarRootProps, { mode: 'range' }>, 'value' | 'mode'>) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Calendar.Root
        aria-label="Stay"
        locale="en-US"
        firstDayOfWeek={7}
        defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
        {...props}
        mode="range"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
      >
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>
      <output data-testid="value">{value ? `${value.start}/${value.end}` : ''}</output>
    </>
  );
}

const october = (n: number) =>
  day(Temporal.PlainDate.from({ year: 2026, month: 10, day: n }).toLocaleString('en-US', { dateStyle: 'full' }));
const selectedCells = () =>
  [...grid().querySelectorAll('td[aria-selected="true"]')].map((cell) => cell.textContent);

describe('Calendar range mode', () => {
  it('picks a range from two picks in either order, and reports it once', () => {
    const onValueChange = vi.fn();
    render(<RangeControlled onValueChange={onValueChange} />);
    fireEvent.click(october(10));
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(october(3));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith({ start: date('2026-10-03'), end: date('2026-10-10') });
    expect(screen.getByTestId('value').textContent).toBe('2026-10-03/2026-10-10');
    fireEvent.click(october(20));
    fireEvent.click(october(22));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-20/2026-10-22');
  });

  it('picks a one-day range from the same day twice', () => {
    render(<RangeControlled />);
    fireEvent.click(october(7));
    fireEvent.click(october(7));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-07/2026-10-07');
    const one = october(7);
    expect(one.hasAttribute('data-range-start')).toBe(true);
    expect(one.hasAttribute('data-range-end')).toBe(true);
    expect(selectedCells()).toEqual(['7']);
  });

  it('lets the grid hold many selected cells in range mode only', () => {
    render(<RangeControlled initial={{ start: date('2025-12-20'), end: date('2027-01-05') }} />);
    expect(grid().getAttribute('aria-multiselectable')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'December 2025' }));
    expect(grid().getAttribute('aria-multiselectable')).toBe('true');
    cleanup();
    render(
      <Calendar.Root aria-label="Start" locale="en-US" defaultMonth={Temporal.PlainYearMonth.from('2026-10')}>
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>,
    );
    expect(grid().hasAttribute('aria-multiselectable')).toBe(false);
  });

  it('selects every cell of the range, fills its ends and marks the days between', () => {
    render(<RangeControlled initial={{ start: date('2026-10-03'), end: date('2026-10-06') }} />);
    expect(selectedCells()).toEqual(['3', '4', '5', '6']);
    expect(october(3).hasAttribute('data-selected')).toBe(true);
    expect(october(3).hasAttribute('data-range-start')).toBe(true);
    expect(october(6).hasAttribute('data-selected')).toBe(true);
    expect(october(6).hasAttribute('data-range-end')).toBe(true);
    expect(october(4).hasAttribute('data-selected')).toBe(false);
    expect(october(4).hasAttribute('data-in-range')).toBe(true);
    expect(october(7).hasAttribute('data-in-range')).toBe(false);
    // The grid starts on the range's start.
    expect(focusedDay()).toBe(october(3));
  });

  it('while waiting for the end, selects only the first pick and previews to the hovered or focused day', () => {
    render(<RangeControlled initial={{ start: date('2026-10-20'), end: date('2026-10-22') }} />);
    fireEvent.click(october(5));
    expect(selectedCells()).toEqual(['5']);
    expect(october(5).hasAttribute('data-selected')).toBe(true);
    expect(october(20).hasAttribute('data-selected')).toBe(false);
    fireEvent.pointerEnter(october(8));
    expect(october(6).hasAttribute('data-in-range')).toBe(true);
    expect(october(7).hasAttribute('data-in-range')).toBe(true);
    expect(october(8).hasAttribute('data-range-end')).toBe(true);
    expect(october(8).hasAttribute('data-selected')).toBe(false);
    expect(october(9).hasAttribute('data-in-range')).toBe(false);
    // Off the grid, the preview follows the focused day.
    fireEvent.pointerLeave(grid());
    expect(october(6).hasAttribute('data-in-range')).toBe(false);
    fireEvent.keyDown(october(5), { key: 'ArrowLeft' });
    expect(october(4).hasAttribute('data-range-start')).toBe(true);
    expect(october(5).hasAttribute('data-range-end')).toBe(true);
    expect(selectedCells()).toEqual(['5']);
  });

  it('previews a new first pick to the focused day, not a day hovered before', () => {
    function Outside() {
      const [value, setValue] = useState<DateRange | null>(null);
      return (
        <>
          <button type="button" onClick={() => setValue({ start: date('2026-10-01'), end: date('2026-10-02') })}>
            set
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={setValue}
          >
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Outside />);
    const inRange = () => [...grid().querySelectorAll('[data-in-range]')].map((cell) => cell.textContent);
    // Escape, a completed range and a value from outside each drop the first pick.
    const drops = [
      () => fireEvent.keyDown(october(5), { key: 'Escape' }),
      () => fireEvent.click(october(8)),
      () => fireEvent.click(screen.getByRole('button', { name: 'set' })),
    ];
    for (const drop of drops) {
      fireEvent.click(october(5));
      fireEvent.pointerEnter(october(8));
      expect(inRange()).toEqual(['6', '7']);
      drop();
      fireEvent.click(october(12));
      expect(inRange()).toEqual([]);
      fireEvent.keyDown(october(12), { key: 'Escape' });
    }
  });

  it('announces that the end date is next after the first pick', async () => {
    render(<RangeControlled />);
    fireEvent.click(october(5));
    await waitFor(() =>
      expect(document.querySelector('[data-todae-announcer] [aria-live="polite"]')!.textContent).toBe(
        'Choose an end date',
      ),
    );
  });

  it('reaches no day past one that cannot be picked', () => {
    const fifteenth = (d: Temporal.PlainDate) => d.day === 15;
    const onValueChange = vi.fn();
    render(<RangeControlled isDateDisabled={fifteenth} onValueChange={onValueChange} />);
    fireEvent.click(october(12));
    // Unreachable days take focus and read as unavailable, but are not struck through.
    const past = october(18);
    expect(past.getAttribute('aria-disabled')).toBe('true');
    expect(past.hasAttribute('data-unavailable')).toBe(false);
    expect(october(14).hasAttribute('aria-disabled')).toBe(false);
    expect(october(15).hasAttribute('data-unavailable')).toBe(true);
    fireEvent.pointerEnter(past);
    expect(october(13).hasAttribute('data-in-range')).toBe(false);
    fireEvent.click(past);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(focusedDay()).toBe(past);
    fireEvent.click(october(14));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-12/2026-10-14');
    expect(october(18).hasAttribute('aria-disabled')).toBe(false);
    // A new first pick looks for its own limits.
    fireEvent.click(october(18));
    expect(october(14).getAttribute('aria-disabled')).toBe('true');
    expect(october(16).hasAttribute('aria-disabled')).toBe(false);
  });

  it('reaches a far year from the first pick without isDateDisabled', { timeout: 15000 }, () => {
    const onValueChange = vi.fn();
    render(<RangeControlled onValueChange={onValueChange} />);
    fireEvent.click(october(5));
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    const nextYears = screen.getByRole('button', { name: 'Next years' });
    for (let year = 2026; year < 9999; year += 12) fireEvent.click(nextYears);
    fireEvent.click(screen.getByRole('button', { name: '9998' }));
    fireEvent.keyDown(focusedDay(), { key: 'PageDown', shiftKey: true });
    const far = day('Tuesday, October 5, 9999');
    expect(far.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(far);
    expect(onValueChange).toHaveBeenCalledWith({ start: date('2026-10-05'), end: date('9999-10-05') });
  });

  it("scans each day once for a range's limits as the grid moves away from the first pick", () => {
    const isDateDisabled = vi.fn(() => false);
    render(<RangeControlled isDateDisabled={isDateDisabled} />);
    fireEvent.click(october(5));
    for (let year = 0; year < 5; year++) fireEvent.keyDown(focusedDay(), { key: 'PageDown', shiftKey: true });
    // A month further, and a render that moves nothing, check no more than that month's days
    // for the range and once more to draw them.
    isDateDisabled.mockClear();
    fireEvent.keyDown(focusedDay(), { key: 'PageDown' });
    expect(screen.getByText('November 2031')).toBeTruthy();
    expect(isDateDisabled.mock.calls.length).toBeLessThanOrEqual(2 * 30);
    isDateDisabled.mockClear();
    fireEvent.pointerEnter(day('Monday, November 10, 2031'));
    expect(isDateDisabled.mock.calls.length).toBeLessThanOrEqual(30);
  });

  it('carries a far scan on after the render, a frame checking one chunk of days before it looks at the clock', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      // Every look at the clock takes longer than a frame's slice, so a frame ends after one chunk.
      let clock = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => (clock += 100));
      let calls = 0;
      const isDateDisabled = () => {
        calls++;
        return false;
      };
      const onValueChange = vi.fn();
      render(<RangeControlled isDateDisabled={isDateDisabled} onValueChange={onValueChange} />);
      fireEvent.click(october(5));
      fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next years' }));
      calls = 0;
      fireEvent.click(screen.getByRole('button', { name: '2031' }));
      // One jump of five years: a render checks about two years of days, and the month's days to draw them.
      expect(calls).toBeLessThanOrEqual(732 + 31);
      const far = day(date('2031-10-05').toLocaleString('en-US', { dateStyle: 'full' }));
      expect(far.getAttribute('aria-disabled')).toBe('true');
      expect(far.hasAttribute('data-unavailable')).toBe(false);
      fireEvent.click(far);
      expect(onValueChange).not.toHaveBeenCalled();
      // One frame goes on by one chunk, and the next is scheduled.
      expect(vi.getTimerCount()).toBe(1);
      calls = 0;
      act(() => vi.advanceTimersToNextFrame());
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThanOrEqual(32);
      expect(far.getAttribute('aria-disabled')).toBe('true');
      expect(vi.getTimerCount()).toBe(1);
      // Frames go on until the scan reaches the day.
      for (let frame = 0; frame < 100 && vi.getTimerCount() > 0; frame++) act(() => vi.advanceTimersToNextFrame());
      expect(vi.getTimerCount()).toBe(0);
      expect(far.hasAttribute('aria-disabled')).toBe(false);
      fireEvent.click(far);
      expect(onValueChange).toHaveBeenCalledWith({ start: date('2026-10-05'), end: date('2031-10-05') });
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('starts a scan that has not finished over when isDateDisabled changes', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      let clock = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => (clock += 100));
      const { rerender } = render(<RangeControlled isDateDisabled={() => false} />);
      fireEvent.click(october(5));
      fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next years' }));
      fireEvent.click(screen.getByRole('button', { name: '2031' }));
      act(() => vi.advanceTimersToNextFrame());
      const calls = vi.fn(() => false);
      rerender(<RangeControlled isDateDisabled={calls} />);
      // The new function is asked about the days again, from the first pick on.
      expect(calls).toHaveBeenCalledWith(date('2026-10-06'));
      expect(calls.mock.calls.length).toBeGreaterThan(700);
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('stops a scan carried on after the render when the first pick goes', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      render(<RangeControlled isDateDisabled={() => false} />);
      fireEvent.click(october(5));
      fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
      fireEvent.keyDown(focusedDay(), { key: 'ArrowDown' });
      fireEvent.click(screen.getByRole('button', { expanded: true }));
      expect(focusedDay().getAttribute('aria-disabled')).toBe('true');
      expect(vi.getTimerCount()).toBe(1);
      fireEvent.keyDown(focusedDay(), { key: 'Escape' });
      expect(vi.getTimerCount()).toBe(0);
      fireEvent.click(focusedDay());
      expect(vi.getTimerCount()).toBe(0);
      cleanup();
      render(<RangeControlled isDateDisabled={() => false} />);
      fireEvent.click(october(5));
      fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
      fireEvent.keyDown(focusedDay(), { key: 'ArrowDown' });
      fireEvent.click(screen.getByRole('button', { expanded: true }));
      expect(vi.getTimerCount()).toBe(1);
      cleanup();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops a range at min and max', () => {
    render(<RangeControlled min={date('2026-10-05')} max={date('2026-10-20')} />);
    fireEvent.click(october(18));
    expect(october(21)).toHaveProperty('disabled', true);
    expect(october(5).hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(october(5));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-05/2026-10-18');
  });

  it.each([
    ['min rises past it', { min: date('2026-10-08') }],
    ['isDateDisabled rules it out', { isDateDisabled: (d: Temporal.PlainDate) => d.day === 5 }],
  ])('drops a first pick when %s', (_, limits) => {
    const onValueChange = vi.fn();
    const { rerender } = render(<RangeControlled onValueChange={onValueChange} />);
    fireEvent.click(october(5));
    rerender(<RangeControlled onValueChange={onValueChange} {...limits} />);
    expect(selectedCells()).toEqual([]);
    fireEvent.click(october(10));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(selectedCells()).toEqual(['10']);
    fireEvent.click(october(12));
    expect(onValueChange).toHaveBeenCalledWith({ start: date('2026-10-10'), end: date('2026-10-12') });
  });

  it('drops the first pick on Escape, keeping the key from what holds the calendar', () => {
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    render(<RangeControlled initial={{ start: date('2026-10-20'), end: date('2026-10-22') }} />);
    fireEvent.click(october(5));
    fireEvent.keyDown(october(5), { key: 'Escape' });
    expect(outside).not.toHaveBeenCalled();
    expect(selectedCells()).toEqual(['20', '21', '22']);
    // With no range in progress, Escape is left alone.
    fireEvent.keyDown(october(5), { key: 'Escape' });
    expect(outside).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', outside);
    fireEvent.click(october(9));
    expect(october(9).hasAttribute('data-selected')).toBe(true);
    expect(screen.getByTestId('value').textContent).toBe('2026-10-20/2026-10-22');
  });

  it('drops the first pick on Escape from anywhere in the calendar', () => {
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    render(<RangeControlled initial={{ start: date('2026-10-20'), end: date('2026-10-22') }} />);
    fireEvent.click(october(5));
    const next = screen.getByRole('button', { name: 'Next month' });
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(outside).not.toHaveBeenCalled();
    expect(selectedCells()).toEqual(['20', '21', '22']);
    fireEvent.click(october(6));
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    fireEvent.keyDown(focusedDay(), { key: 'Escape' });
    expect(outside).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(selectedCells()).toEqual(['20', '21', '22']);
    document.removeEventListener('keydown', outside);
  });

  it('follows a range set from outside to its start, dropping a first pick', () => {
    function Outside() {
      const [value, setValue] = useState<DateRange | null>(null);
      return (
        <>
          <button type="button" onClick={() => setValue({ start: date('2027-03-02'), end: date('2027-03-09') })}>
            set
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={setValue}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Outside />);
    fireEvent.click(october(5));
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByText('March 2027')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Tuesday, March 2, 2027');
    expect(selectedCells()).toEqual(['2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('stays on the month a range ends in', () => {
    render(<RangeControlled />);
    fireEvent.click(october(28));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Wednesday, November 4, 2026'));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-28/2026-11-04');
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Wednesday, November 4, 2026');
  });

  it.each([
    ['in a transition', (answer: () => void) => startTransition(answer)],
    ['after a timeout', (answer: () => void) => setTimeout(answer, 0)],
  ])('stays on the month a range ends in when a controlling parent answers %s', async (_, later) => {
    function Late() {
      const [value, setValue] = useState<DateRange | null>(null);
      return (
        <>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={(next) => later(() => setValue(next))}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
          <output data-testid="value">{value ? `${value.start}/${value.end}` : ''}</output>
        </>
      );
    }
    render(<Late />);
    fireEvent.click(october(28));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Wednesday, November 4, 2026'));
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('2026-10-28/2026-11-04'));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Wednesday, November 4, 2026');
    expect(selectedCells()).toEqual(['1', '2', '3', '4']);
  });

  it('keeps the month and a new first pick when a controlling parent answers a range late', () => {
    function Late() {
      const [value, setValue] = useState<DateRange | null>(null);
      const [asked, setAsked] = useState<DateRange | null>(null);
      return (
        <>
          <button type="button" onClick={() => setValue(asked)}>
            answer
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={setAsked}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Late />);
    fireEvent.click(october(5));
    fireEvent.click(october(8));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const tenth = day('Tuesday, November 10, 2026');
    fireEvent.click(tenth);
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Tuesday, November 10, 2026');
    expect(selectedCells()).toEqual(['10']);
    fireEvent.click(day('Thursday, November 12, 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(selectedCells()).toEqual(['10', '11', '12']);
  });

  it('takes each of two quick picks answered late, in order, as an answer, moving nothing', () => {
    function Late() {
      const [value, setValue] = useState<DateRange | null>(null);
      const [asked, setAsked] = useState<DateRange[]>([]);
      return (
        <>
          <button type="button" onClick={() => setValue(asked[0]!)}>
            answer first
          </button>
          <button type="button" onClick={() => setValue(asked[1]!)}>
            answer second
          </button>
          <button type="button" onClick={() => setValue({ start: date('2027-01-05'), end: date('2027-01-08') })}>
            other
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={(next) => setAsked((current) => [...current, next])}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Late />);
    fireEvent.click(october(5));
    fireEvent.click(october(8));
    fireEvent.click(october(10));
    fireEvent.click(october(12));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Tuesday, November 10, 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'answer first' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(selectedCells()).toEqual(['10']);
    fireEvent.click(screen.getByRole('button', { name: 'answer second' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(selectedCells()).toEqual(['10']);
    // Both are answered, so a value from outside moves the grid again.
    fireEvent.click(screen.getByRole('button', { name: 'other' }));
    expect(screen.getByText('January 2027')).toBeTruthy();
    expect(selectedCells()).toEqual(['5', '6', '7', '8']);
  });

  it.each([
    [8, 'November 2026'],
    [9, 'October 2026'],
  ])('remembers only the last eight picks no value has answered: after %i, the first one answered shows %s', (picks, month) => {
    function Late() {
      const [value, setValue] = useState<DateRange | null>(null);
      const [asked, setAsked] = useState<DateRange[]>([]);
      return (
        <>
          <button type="button" onClick={() => setValue(asked[0]!)}>
            answer first
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={(next) => setAsked((current) => [...current, next])}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Late />);
    // One-day picks from October 1.
    for (let n = 1; n <= picks; n++) {
      fireEvent.click(october(n));
      fireEvent.click(october(n));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    // A remembered pick's answer moves nothing; a forgotten one's comes from outside.
    fireEvent.click(screen.getByRole('button', { name: 'answer first' }));
    expect(screen.getByText(month)).toBeTruthy();
  });

  it('forgets the picks no value has answered once another value arrives', () => {
    function Late() {
      const [value, setValue] = useState<DateRange | null>(null);
      const [asked, setAsked] = useState<DateRange | null>(null);
      return (
        <>
          <button type="button" onClick={() => setValue(asked)}>
            answer
          </button>
          <button type="button" onClick={() => setValue({ start: date('2027-01-05'), end: date('2027-01-08') })}>
            other
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={setAsked}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Late />);
    fireEvent.click(october(5));
    fireEvent.click(october(8));
    fireEvent.click(screen.getByRole('button', { name: 'other' }));
    expect(screen.getByText('January 2027')).toBeTruthy();
    // The pick of October is not answered by a value that comes after another one.
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(screen.getByText('October 2026')).toBeTruthy();
  });

  it('takes a range equal to one a controlling parent turned down as its answer, moving nothing', () => {
    function Rejecting() {
      const [value, setValue] = useState<DateRange | null>(null);
      return (
        <>
          <button type="button" onClick={() => setValue({ start: date('2026-10-05'), end: date('2026-10-08') })}>
            set
          </button>
          <button type="button" onClick={() => setValue({ start: date('2027-01-05'), end: date('2027-01-08') })}>
            other
          </button>
          <Calendar.Root
            aria-label="Stay"
            locale="en-US"
            mode="range"
            defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
            value={value}
            onValueChange={() => {}}
          >
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Rejecting />);
    fireEvent.click(october(5));
    fireEvent.click(october(8));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'other' }));
    expect(screen.getByText('January 2027')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(selectedCells()).toEqual(['5', '6', '7', '8']);
  });

  it('stays where a range ends when a controlling parent turns it down', () => {
    const onValueChange = vi.fn();
    render(
      <Calendar.Root
        aria-label="Stay"
        locale="en-US"
        mode="range"
        value={{ start: date('2026-10-03'), end: date('2026-10-04') }}
        onValueChange={onValueChange}
      >
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>,
    );
    fireEvent.click(october(28));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Wednesday, November 4, 2026'));
    expect(onValueChange).toHaveBeenCalledWith({ start: date('2026-10-28'), end: date('2026-11-04') });
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Wednesday, November 4, 2026');
    expect(selectedCells()).toEqual([]);
  });

  it('selects every year a range touches in the page of years', () => {
    render(<RangeControlled initial={{ start: date('2025-12-20'), end: date('2027-01-05') }} />);
    fireEvent.click(screen.getByRole('button', { name: 'December 2025' }));
    expect(selectedCells()).toEqual(['2025', '2026', '2027']);
  });

  it('selects the year of a first pick in the page of years, not the range it replaces', () => {
    render(<RangeControlled initial={{ start: date('2025-12-20'), end: date('2027-01-05') }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Monday, January 5, 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'January 2026' }));
    expect(selectedCells()).toEqual(['2026']);
  });

  it('selects only the year of a first pick in the page of years as the keys move', () => {
    render(<RangeControlled initial={{ start: date('2026-10-20'), end: date('2027-01-05') }} />);
    fireEvent.click(october(5));
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    expect(selectedCells()).toEqual(['2026']);
    // 2027 is in the range the first pick replaces, and in the range it previews.
    fireEvent.keyDown(focusedDay(), { key: 'ArrowRight' });
    expect(focusedDay().textContent).toBe('2027');
    expect(selectedCells()).toEqual(['2026']);
    fireEvent.keyDown(focusedDay(), { key: 'ArrowLeft' });
    fireEvent.keyDown(focusedDay(), { key: 'ArrowLeft' });
    expect(focusedDay().textContent).toBe('2025');
    expect(selectedCells()).toEqual(['2026']);
  });

  it('reports a mode changed after mounting once, drops a first pick, and hands each mode its own value', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDate = vi.fn();
    const onRange = vi.fn();
    const props = { 'aria-label': 'Stay', locale: 'en-US', defaultMonth: Temporal.PlainYearMonth.from('2026-10') };
    const { rerender } = render(
      <Calendar.Root {...props} mode="range" onValueChange={onRange}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    fireEvent.click(october(5));
    expect(error).not.toHaveBeenCalled();
    rerender(
      <Calendar.Root {...props} onValueChange={onDate}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    rerender(
      <Calendar.Root {...props} onValueChange={onDate}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('cannot change mode'));
    expect(selectedCells()).toEqual([]);
    fireEvent.click(october(8));
    expect(onDate).toHaveBeenCalledWith(date('2026-10-08'));
    expect(selectedCells()).toEqual(['8']);
    rerender(
      <Calendar.Root {...props} mode="range" onValueChange={onRange}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    fireEvent.click(october(10));
    fireEvent.click(october(12));
    expect(onRange).toHaveBeenCalledWith({ start: date('2026-10-10'), end: date('2026-10-12') });
    expect(selectedCells()).toEqual(['10', '11', '12']);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('keeps its own range when uncontrolled', () => {
    const onValueChange = vi.fn();
    render(
      <Calendar.Root
        aria-label="Stay"
        locale="en-US"
        mode="range"
        defaultValue={{ start: date('2026-10-03'), end: date('2026-10-04') }}
        onValueChange={onValueChange}
      >
        <Calendar.Grid />
      </Calendar.Root>,
    );
    fireEvent.click(october(8));
    fireEvent.click(october(10));
    expect(onValueChange).toHaveBeenCalledWith({ start: date('2026-10-08'), end: date('2026-10-10') });
    expect(selectedCells()).toEqual(['8', '9', '10']);
  });
});
