import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calendar, Fieldset, StringsProvider, type CalendarRootProps } from '../index';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);

function Controlled({
  initial = date('2026-10-13'),
  onValueChange,
  ...props
}: { initial?: Temporal.PlainDate | null } & Omit<CalendarRootProps, 'value'>) {
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
    expect(grid().querySelectorAll('[data-todae-calendar-day]')).toHaveLength(31);
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
    expect(heading.textContent).toBe('2016 – 2027');
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
    expect(screen.getByRole('button', { name: '2028 – 2039' })).toBeTruthy();
    press('ArrowLeft');
    press('PageUp');
    expect(document.activeElement!.textContent).toBe('2022');
  });

  it('pages the years from the header buttons', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next years' }));
    expect(screen.getByRole('button', { name: '2028 – 2039' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous years' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous years' }));
    expect(screen.getByRole('button', { name: '2004 – 2015' })).toBeTruthy();
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

  it('names its month buttons from StringsProvider', () => {
    render(
      <StringsProvider strings={{ previousMonth: '이전 달', nextMonth: '다음 달' }}>
        <Controlled />
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: '이전 달' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 달' })).toBeTruthy();
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
