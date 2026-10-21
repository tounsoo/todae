import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calendar, Fieldset, StringsProvider, type CalendarRootProps, type DateRange } from '../index.js';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);

function Controlled({
  initial = date('2026-10-13'),
  onValueChange,
  ...props
}: { initial?: Temporal.PlainDate | null } & Omit<Extract<CalendarRootProps, { mode?: 'single' }>, 'value'>) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Calendar.Root
        aria-label="Start"
        locale="en-US"
        firstDayOfWeek={7}
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
      >
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>
      <output data-testid="value">{value?.toString() ?? ''}</output>
    </>
  );
}

const grid = () => screen.getByRole('grid');
const focusedDay = () => grid().querySelector<HTMLButtonElement>('[tabindex="0"]')!;
const day = (name: string) => screen.getByRole('button', { name });

describe('Calendar', () => {
  it('is a named group with the month heading, month buttons and a grid of the month', () => {
    render(<Controlled />);
    expect(screen.getByRole('group', { name: 'Start' })).toBeTruthy();
    const heading = screen.getByRole('button', { name: 'October 2026' });
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(heading.parentElement!.getAttribute('aria-live')).toBe('polite');
    expect(grid().getAttribute('aria-labelledby')).toBe(heading.id);
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
    const headers = within(grid()).getAllByRole('columnheader');
    expect(headers.map((th) => th.textContent)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(headers[0]!.getAttribute('abbr')).toBe('Sunday');
    // October 2026 starts on a Thursday: four empty cells, then 31 days, in five weeks.
    expect(within(grid()).getAllByRole('row')).toHaveLength(6);
    expect(grid().querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(31);
    expect(grid().querySelector('tbody td')!.childElementCount).toBe(0);
  });

  it('marks the selected date on its cell, and is one Tab stop on it', () => {
    render(<Controlled />);
    const selected = day('Tuesday, October 13, 2026');
    expect(selected.closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(selected.hasAttribute('data-selected')).toBe(true);
    expect(focusedDay()).toBe(selected);
    expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('starts the columns on firstDayOfWeek', () => {
    render(<Controlled firstDayOfWeek={1} />);
    expect(within(grid()).getAllByRole('columnheader')[0]!.textContent).toBe('Mon');
  });

  it('names the days and the month in its locale', () => {
    render(<Controlled locale="ko-KR" />);
    expect(screen.getByText('2026년 10월')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('2026년 10월 13일 화요일');
  });

  it('picks a clicked date and reports it', () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    fireEvent.click(day('Monday, October 5, 2026'));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-05');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(focusedDay()).toBe(day('Monday, October 5, 2026'));
    // Picking the date it already has is reported too, so a picker can close on it.
    fireEvent.click(day('Monday, October 5, 2026'));
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('moves focus by day, week, week end, month and year from the keyboard', () => {
    render(<Controlled />);
    const press = (key: string, shiftKey = false) => {
      fireEvent.keyDown(focusedDay(), { key, shiftKey });
      return focusedDay().getAttribute('aria-label');
    };
    focusedDay().focus();
    expect(press('ArrowRight')).toBe('Wednesday, October 14, 2026');
    expect(document.activeElement).toBe(focusedDay());
    expect(press('ArrowLeft')).toBe('Tuesday, October 13, 2026');
    expect(press('ArrowDown')).toBe('Tuesday, October 20, 2026');
    expect(press('ArrowUp')).toBe('Tuesday, October 13, 2026');
    expect(press('Home')).toBe('Sunday, October 11, 2026');
    expect(press('End')).toBe('Saturday, October 17, 2026');
    expect(press('PageDown')).toBe('Tuesday, November 17, 2026');
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(press('PageUp')).toBe('Saturday, October 17, 2026');
    expect(press('PageDown', true)).toBe('Sunday, October 17, 2027');
    expect(press('PageUp', true)).toBe('Saturday, October 17, 2026');
    // Moving focus picks nothing.
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
  });

  it('lets a Grid onKeyDown that prevents the default keep the key', () => {
    render(
      <Calendar.Root aria-label="Start" locale="en-US" defaultValue={date('2026-10-13')}>
        <Calendar.Grid onKeyDown={(event) => event.preventDefault()} />
      </Calendar.Root>,
    );
    fireEvent.keyDown(focusedDay(), { key: 'ArrowRight' });
    expect(focusedDay().getAttribute('aria-label')).toBe('Tuesday, October 13, 2026');
  });

  it('changes the month from the header without moving focus or the value', () => {
    render(<Controlled />);
    const next = screen.getByRole('button', { name: 'Next month' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Friday, November 13, 2026');
    expect(document.activeElement).toBe(next);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
  });

  it('switches the grid to a page of years from the heading, and back', () => {
    render(<Controlled />);
    const heading = screen.getByRole('button', { name: 'October 2026' });
    fireEvent.click(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(heading.textContent).toBe('2016–2027');
    const years = within(grid()).getAllByRole('button');
    expect(years.map((year) => year.textContent)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(2016 + index)),
    );
    expect(within(grid()).getAllByRole('row')).toHaveLength(3);
    expect(focusedDay().textContent).toBe('2026');
    expect(focusedDay().closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Previous years' })).toBeTruthy();
    fireEvent.click(heading);
    expect(heading.textContent).toBe('October 2026');
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
  });

  it('picks a year, keeping the month and day, and shows its month with focus on the date', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    fireEvent.click(within(grid()).getByRole('button', { name: '2021' }));
    expect(screen.getByRole('button', { name: 'October 2021' })).toBeTruthy();
    expect(document.activeElement).toBe(day('Wednesday, October 13, 2021'));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
  });

  it('keeps February 29 where the picked year has no such day', () => {
    render(<Controlled initial={date('2028-02-29')} />);
    fireEvent.click(screen.getByRole('button', { name: 'February 2028' }));
    fireEvent.click(within(grid()).getByRole('button', { name: '2029' }));
    expect(focusedDay().getAttribute('aria-label')).toBe('Wednesday, February 28, 2029');
  });

  it('moves through the years from the keyboard, by year, row and page', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    focusedDay().focus();
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    press('ArrowRight');
    expect(document.activeElement!.textContent).toBe('2027');
    press('ArrowUp');
    expect(document.activeElement!.textContent).toBe('2023');
    press('Home');
    expect(document.activeElement!.textContent).toBe('2020');
    press('End');
    expect(document.activeElement!.textContent).toBe('2023');
    press('PageDown');
    expect(document.activeElement!.textContent).toBe('2035');
    expect(screen.getByRole('button', { name: '2028–2039' })).toBeTruthy();
    press('ArrowLeft');
    press('PageUp');
    expect(document.activeElement!.textContent).toBe('2022');
  });

  it('pages the years from the header buttons', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next years' }));
    expect(screen.getByRole('button', { name: '2028–2039' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous years' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous years' }));
    expect(screen.getByRole('button', { name: '2004–2015' })).toBeTruthy();
  });

  it('disables the years outside min and max, and the page buttons past them', () => {
    render(<Controlled min={date('2024-03-01')} max={date('2027-06-30')} />);
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    const enabled = within(grid())
      .getAllByRole('button')
      .filter((year) => !(year as HTMLButtonElement).disabled)
      .map((year) => year.textContent);
    expect(enabled).toEqual(['2024', '2025', '2026', '2027']);
    expect(screen.getByRole('button', { name: 'Previous years' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Next years' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(within(grid()).getByRole('button', { name: '2027' }));
    expect(focusedDay().getAttribute('aria-label')).toBe('Wednesday, June 30, 2027');
    fireEvent.click(screen.getByRole('button', { name: 'June 2027' }));
    focusedDay().focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement!.textContent).toBe('2027');
  });

  it('stops the year keys at min and max, keeping the month and day where the year stays', () => {
    render(<Controlled initial={date('2027-06-10')} min={date('2025-03-01')} max={date('2030-06-30')} />);
    fireEvent.click(screen.getByRole('button', { name: 'June 2027' }));
    focusedDay().focus();
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    press('Home');
    expect(document.activeElement!.textContent).toBe('2025');
    press('ArrowUp');
    expect(document.activeElement!.textContent).toBe('2025');
    press('End');
    expect(document.activeElement!.textContent).toBe('2027');
    press('PageDown');
    expect(document.activeElement!.textContent).toBe('2030');
    press('PageDown');
    press('ArrowRight');
    expect(document.activeElement!.textContent).toBe('2030');
    press('PageUp');
    expect(document.activeElement!.textContent).toBe('2025');
    // The year never moved past a bound, so neither did the month and day.
    fireEvent.click(document.activeElement!);
    expect(focusedDay().getAttribute('aria-label')).toBe('Tuesday, June 10, 2025');
  });

  it('shows the days again when the header goes while the years show', () => {
    function Toggle() {
      const [header, setHeader] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setHeader(false)}>
            Hide
          </button>
          <Calendar.Root aria-label="Start" locale="en-US" defaultValue={date('2026-10-13')}>
            {header && <Calendar.Header />}
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Toggle />);
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    expect(within(grid()).getAllByRole('button')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(grid().querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(31);
  });

  it.each([
    ['+275759-10-15', '275760', 'Sunday, August 31, 275760'],
    ['+275759-09-10', '275760', 'Sunday, August 31, 275760'],
    ['-271820-02-15', '-271821', 'Tuesday, June 1, 271822'],
    ['-271820-05-15', '-271821', 'Tuesday, June 1, 271822'],
  ] as const)('from %s, picking %s stops at the months the calendar can show', (iso, year, label) => {
    render(<Controlled initial={date(iso)} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    // 275760 starts the next page of years.
    if (year === '275760') fireEvent.click(screen.getByRole('button', { name: 'Next years' }));
    fireEvent.click(within(grid()).getByRole('button', { name: year }));
    expect(focusedDay().getAttribute('aria-label')).toBe(label);
  });

  it('keeps the day of the month as far as the next month has it', () => {
    render(<Controlled initial={date('2026-01-31')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(focusedDay().getAttribute('aria-label')).toBe('Saturday, February 28, 2026');
  });

  it('keeps focus and the month in min and max, and marks dates outside them', () => {
    render(<Controlled min={date('2026-10-05')} max={date('2026-10-20')} />);
    const previous = screen.getByRole('button', { name: 'Previous month' });
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(next);
    expect(screen.getByText('October 2026')).toBeTruthy();
    fireEvent.keyDown(focusedDay(), { key: 'PageDown' });
    expect(focusedDay().getAttribute('aria-label')).toBe('Tuesday, October 20, 2026');
    fireEvent.keyDown(focusedDay(), { key: 'PageUp' });
    expect(focusedDay().getAttribute('aria-label')).toBe('Monday, October 5, 2026');
    // Outside the range a day is disabled, as the keys never reach it.
    const outside = day('Sunday, October 4, 2026') as HTMLButtonElement;
    expect(outside.disabled).toBe(true);
    expect(outside.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(outside);
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
    expect(focusedDay().getAttribute('aria-label')).toBe('Monday, October 5, 2026');
  });

  it('takes no focus on a later render after a key at a bound', () => {
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            {`render ${count}`}
          </button>
          <Controlled min={date('2026-10-13')} />
        </>
      );
    }
    render(<Parent />);
    focusedDay().focus();
    fireEvent.keyDown(focusedDay(), { key: 'ArrowLeft' });
    fireEvent.keyDown(focusedDay(), { key: 'ArrowLeft' });
    const other = screen.getByRole('button', { name: 'render 0' });
    other.focus();
    fireEvent.click(other);
    expect(screen.getByRole('button', { name: 'render 1' })).toBe(document.activeElement);
  });

  it('names months and days from the Gregorian calendar, whatever the locale uses', () => {
    render(<Controlled locale="fa-IR" />);
    const heading = document.getElementById(grid().getAttribute('aria-labelledby')!)!;
    expect(heading.textContent).toBe(Temporal.PlainDate.from('2026-10-13').toLocaleString('fa-IR', { month: 'long', year: 'numeric', calendar: 'gregory' }));
    expect(heading.textContent).not.toBe(Temporal.PlainDate.from('2026-10-13').toLocaleString('fa-IR', { month: 'long', year: 'numeric' }));
  });

  it("starts on the locale's first day, read from either form of Intl.Locale's week info", () => {
    // Node 22 has only the weekInfo accessor; browsers have getWeekInfo().
    render(
      <Calendar.Root aria-label="Start" locale="de-DE" defaultValue={date('2026-10-13')}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    expect(within(grid()).getAllByRole('columnheader')[0]!.getAttribute('abbr')).toBe('Montag');
  });

  it('labels the grid by the header only while a header is rendered', () => {
    const { rerender } = render(
      <Calendar.Root aria-label="Start" locale="en-US" defaultValue={date('2026-10-13')}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    expect(grid().hasAttribute('aria-labelledby')).toBe(false);
    rerender(
      <Calendar.Root aria-label="Start" locale="en-US" defaultValue={date('2026-10-13')}>
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>,
    );
    expect(document.getElementById(grid().getAttribute('aria-labelledby')!)!.textContent).toBe('October 2026');
  });

  it('keeps a date from isDateDisabled focusable but not pickable', () => {
    const weekend = (d: Temporal.PlainDate) => d.dayOfWeek >= 6;
    render(<Controlled isDateDisabled={weekend} />);
    const saturday = day('Saturday, October 17, 2026');
    expect(saturday.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(saturday);
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
    expect(focusedDay()).toBe(saturday);
  });

  it("marks today with aria-current and starts on today's month without a value", () => {
    const today = Temporal.Now.plainDateISO();
    render(<Controlled initial={null} />);
    const current = grid().querySelector('[aria-current="date"]')!;
    expect(current.textContent).toBe(String(today.day));
    expect(focusedDay()).toBe(current);
    expect(grid().querySelector('[aria-selected]')).toBeNull();
  });

  it.each(['japanese', 'hebrew', 'gregory'])('lays out a %s value and limits on the ISO grid', (calendar) => {
    render(
      <Controlled
        initial={date('2026-10-13').withCalendar(calendar)}
        min={date('2026-10-05').withCalendar(calendar)}
      />,
    );
    expect(screen.getByText('October 2026')).toBeTruthy();
    const selected = day('Tuesday, October 13, 2026');
    expect(selected.closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(day('Sunday, October 4, 2026')).toHaveProperty('disabled', true);
  });

  it('marks today with aria-current when the value is in another calendar', () => {
    const today = Temporal.Now.plainDateISO();
    render(<Controlled initial={today.withCalendar('gregory')} />);
    expect(focusedDay().getAttribute('aria-current')).toBe('date');
  });

  it('starts on defaultMonth without a value', () => {
    render(<Controlled initial={null} defaultMonth={Temporal.PlainYearMonth.from('2027-02')} />);
    expect(screen.getByText('February 2027')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Monday, February 1, 2027');
  });

  it('follows a value set from outside to its month', () => {
    function Outside() {
      const [value, setValue] = useState<Temporal.PlainDate | null>(date('2026-10-13'));
      return (
        <>
          <button type="button" onClick={() => setValue(date('2027-03-02'))}>
            set
          </button>
          <Calendar.Root aria-label="Start" locale="en-US" value={value} onValueChange={setValue}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Outside />);
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByText('March 2027')).toBeTruthy();
    expect(focusedDay().getAttribute('aria-label')).toBe('Tuesday, March 2, 2027');
  });

  it('keeps its own value when uncontrolled', () => {
    const onValueChange = vi.fn();
    render(
      <Calendar.Root aria-label="Start" locale="en-US" defaultValue={date('2026-10-13')} onValueChange={onValueChange}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    fireEvent.click(day('Thursday, October 1, 2026'));
    expect(day('Thursday, October 1, 2026').closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(onValueChange).toHaveBeenCalledWith(date('2026-10-01'));
  });

  it('disables every button when disabled, or in a disabled Fieldset', () => {
    render(
      <Fieldset.Root disabled>
        <Controlled />
      </Fieldset.Root>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.click(day('Monday, October 5, 2026'));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
  });

  it('names its month and year page buttons from StringsProvider', () => {
    render(
      <StringsProvider
        strings={{ previousMonth: '이전 달', nextMonth: '다음 달', previousYears: '이전 해', nextYears: '다음 해' }}
      >
        <Controlled />
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: '이전 달' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 달' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    expect(screen.getByRole('button', { name: '이전 해' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 해' })).toBeTruthy();
  });

  it('renders no today and, without a value or defaultMonth, no weeks on the server', () => {
    const parts = (
      <>
        <Calendar.Header />
        <Calendar.Grid />
      </>
    );
    const empty = renderToString(
      <Calendar.Root aria-label="Start" locale="en-US">
        {parts}
      </Calendar.Root>,
    );
    expect(empty).not.toContain('<tbody><tr');
    expect(empty).toContain('abbr="Sunday"');
    const dated = renderToString(
      <Calendar.Root aria-label="Start" locale="en-US" defaultValue={date('2026-10-13')}>
        {parts}
      </Calendar.Root>,
    );
    expect(dated).toContain('October 2026');
    expect(dated).not.toContain('aria-current');
  });

  it('throws when a part renders outside Calendar.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Calendar.Grid />)).toThrow('Calendar.Grid must render inside Calendar.Root');
    vi.restoreAllMocks();
  });
});

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
  });

  it('stops a range at min and max', () => {
    render(<RangeControlled min={date('2026-10-05')} max={date('2026-10-20')} />);
    fireEvent.click(october(18));
    expect(october(21)).toHaveProperty('disabled', true);
    expect(october(5).hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(october(5));
    expect(screen.getByTestId('value').textContent).toBe('2026-10-05/2026-10-18');
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

  it('selects every year a range touches in the page of years', () => {
    render(<RangeControlled initial={{ start: date('2025-12-20'), end: date('2027-01-05') }} />);
    fireEvent.click(screen.getByRole('button', { name: 'December 2025' }));
    expect(selectedCells()).toEqual(['2025', '2026', '2027']);
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
