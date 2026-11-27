import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useId, useState, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetWarnOnce } from '../internal/warnOnce.js';
import { Calendar, Fieldset, StringsProvider, type CalendarRootProps } from '../index.js';

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
/** A day button's name: it is named by its content, the date, and its number is hidden from that name. */
const dayName = (day: Element) => {
  const copy = day.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent;
};
/** The day button for a date's full name. A day with content is named by the date, then that content, a space apart. */
const day = (date: string) => screen.getByRole('button', { name: (name) => name === date || name.startsWith(`${date} `) });
/** What a day or year button shows: a day's number, or a year. */
const shown = (cell: Element) => (cell.querySelector('[aria-hidden="true"]') ?? cell).textContent;

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
    expect(dayName(focusedDay())).toBe('2026년 10월 13일 화요일');
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
    // Each day is named by its date, then its note.
    const press = (key: string, shiftKey = false) => {
      fireEvent.keyDown(focusedDay(), { key, shiftKey });
      return dayName(focusedDay())?.replace(/ note$/, '');
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
    expect(dayName(focusedDay())).toBe('Tuesday, October 13, 2026');
  });

  it('changes the month from the header without moving focus or the value', () => {
    render(<Controlled />);
    const next = screen.getByRole('button', { name: 'Next month' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(dayName(focusedDay())).toBe('Friday, November 13, 2026');
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
    expect(dayName(focusedDay())).toBe('Wednesday, February 28, 2029');
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
    expect(dayName(focusedDay())).toBe('Wednesday, June 30, 2027');
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
    expect(dayName(focusedDay())).toBe('Tuesday, June 10, 2025');
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
    expect(dayName(focusedDay())).toBe(label);
  });

  it('keeps the day of the month as far as the next month has it', () => {
    render(<Controlled initial={date('2026-01-31')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(dayName(focusedDay())).toBe('Saturday, February 28, 2026');
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
    expect(dayName(focusedDay())).toBe('Tuesday, October 20, 2026');
    fireEvent.keyDown(focusedDay(), { key: 'PageUp' });
    expect(dayName(focusedDay())).toBe('Monday, October 5, 2026');
    // Outside the range a day is disabled, as the keys never reach it.
    const outside = day('Sunday, October 4, 2026') as HTMLButtonElement;
    expect(outside.disabled).toBe(true);
    expect(outside.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(outside);
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
    expect(dayName(focusedDay())).toBe('Monday, October 5, 2026');
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

  it("starts a German week on Monday from getWeekInfo, and from the weekInfo accessor when that method is missing", () => {
    const german = (
      <Calendar.Root aria-label="Start" locale="de-DE" defaultValue={date('2026-10-13')}>
        <Calendar.Grid />
      </Calendar.Root>
    );
    const { unmount } = render(german);
    expect(within(grid()).getAllByRole('columnheader')[0]!.getAttribute('abbr')).toBe('Montag');
    unmount();

    const proto = Intl.Locale.prototype as Intl.Locale & { getWeekInfo?: () => { firstDay: number } };
    const original = Object.getOwnPropertyDescriptor(proto, 'getWeekInfo');
    Object.defineProperty(proto, 'getWeekInfo', { configurable: true, value: undefined });
    try {
      render(german);
      expect(within(grid()).getAllByRole('columnheader')[0]!.getAttribute('abbr')).toBe('Montag');
    } finally {
      if (original) Object.defineProperty(proto, 'getWeekInfo', original);
      else delete proto.getWeekInfo;
    }
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
    expect(shown(current)).toBe(String(today.day));
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
    expect(dayName(focusedDay())).toBe('Monday, February 1, 2027');
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
    expect(dayName(focusedDay())).toBe('Tuesday, March 2, 2027');
  });

  it('stays on a picked date that a controlling parent turns down', () => {
    const onValueChange = vi.fn();
    render(
      <Calendar.Root aria-label="Start" locale="en-US" value={date('2026-10-13')} onValueChange={onValueChange}>
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Wednesday, November 4, 2026'));
    expect(onValueChange).toHaveBeenCalledWith(date('2026-11-04'));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(dayName(focusedDay())).toBe('Wednesday, November 4, 2026');
    expect(focusedDay().closest('td')!.hasAttribute('aria-selected')).toBe(false);
  });

  it('takes a value equal to a pick a controlling parent turned down as its answer, moving nothing', () => {
    function Rejecting() {
      const [value, setValue] = useState<Temporal.PlainDate | null>(date('2026-10-13'));
      return (
        <>
          <button type="button" onClick={() => setValue(date('2026-11-04'))}>
            set
          </button>
          <button type="button" onClick={() => setValue(date('2026-12-08'))}>
            other
          </button>
          <Calendar.Root aria-label="Start" locale="en-US" value={value} onValueChange={() => {}}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Rejecting />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(day('Wednesday, November 4, 2026'));
    for (let month = 0; month < 4; month++) fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('March 2027')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByText('March 2027')).toBeTruthy();
    // Another value forgets the pick, so the same value set again moves the grid.
    fireEvent.click(screen.getByRole('button', { name: 'other' }));
    expect(screen.getByText('December 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(dayName(focusedDay())).toBe('Wednesday, November 4, 2026');
    expect(focusedDay().closest('td')!.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the month shown when a controlling parent answers a pick after focus moved on', () => {
    function Late() {
      const [value, setValue] = useState<Temporal.PlainDate | null>(date('2026-10-13'));
      const [asked, setAsked] = useState<Temporal.PlainDate | null>(null);
      return (
        <>
          <button type="button" onClick={() => setValue(asked)}>
            answer
          </button>
          <Calendar.Root aria-label="Start" locale="en-US" value={value} onValueChange={setAsked}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </>
      );
    }
    render(<Late />);
    fireEvent.click(day('Tuesday, October 20, 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(dayName(focusedDay())).toBe('Friday, November 20, 2026');
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

  it('renders renderDay for each day of the matrix with that day and its state', () => {
    const today = Temporal.Now.plainDateISO().toString();
    const flags = (day: {
      date: Temporal.PlainDate;
      outside: boolean;
      selected: boolean;
      disabled: boolean;
      today: boolean;
    }) =>
      [
        day.date.toString(),
        day.outside ? 'outside' : 'in',
        day.selected ? 'selected' : 'open',
        day.disabled ? 'disabled' : 'enabled',
        day.today ? 'today' : 'other',
      ].join(' ');
    render(
      <Calendar.Root
        aria-label="Start"
        locale="en-US"
        firstDayOfWeek={7}
        value={date('2026-10-13')}
        onValueChange={() => undefined}
        min={date('2026-10-05')}
        isDateDisabled={(day) => day.toString() === '2026-10-17'}
      >
        <Calendar.Header />
        <Calendar.Grid showOutsideDays renderDay={(day) => flags(day)} />
      </Calendar.Root>,
    );
    // October 2026 starts on a Thursday. A Sunday-first week leads with September 27 to 30.
    const first = date('2026-10-01');
    const lead = (first.dayOfWeek - 7 + 7) % 7;
    const days = [
      ...Array.from({ length: lead }, (_, index) => first.subtract({ days: lead - index })),
      ...Array.from({ length: first.daysInMonth }, (_, index) => first.add({ days: index })),
    ];
    expect(grid().querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(days.length);
    expect(grid().querySelectorAll('[data-outside]')).toHaveLength(lead);
    for (const day of days) {
      const iso = day.toString();
      const outside = day.month !== 10;
      const selected = iso === '2026-10-13';
      const disabled = Temporal.PlainDate.compare(day, date('2026-10-05')) < 0 || iso === '2026-10-17';
      expect(
        screen.getByText(
          `${iso} ${outside ? 'outside' : 'in'} ${selected ? 'selected' : 'open'} ${disabled ? 'disabled' : 'enabled'} ${iso === today ? 'today' : 'other'}`,
        ),
      ).toBeTruthy();
    }
    const picked = day('Tuesday, October 13, 2026');
    expect(picked.textContent).toContain('2026-10-13');
    expect(dayName(picked)).toBe('Tuesday, October 13, 2026 2026-10-13 in selected enabled other');
    const ruledOut = day('Saturday, October 17, 2026') as HTMLButtonElement;
    expect(ruledOut.disabled).toBe(false);
    expect(ruledOut.getAttribute('aria-disabled')).toBe('true');
  });

  it('marks every day of a range for renderDay, and drops day content on the year page', () => {
    render(
      <Calendar.Root
        aria-label="Trip"
        locale="en-US"
        firstDayOfWeek={7}
        mode="range"
        value={{ start: date('2026-10-13'), end: date('2026-10-15') }}
        onValueChange={() => undefined}
      >
        <Calendar.Header />
        <Calendar.Grid showOutsideDays renderDay={(day) => `${day.date.toString()} ${day.selected ? 'selected' : 'open'}`} />
      </Calendar.Root>,
    );
    expect(screen.getByText('2026-10-12 open')).toBeTruthy();
    expect(screen.getByText('2026-10-13 selected')).toBeTruthy();
    expect(screen.getByText('2026-10-14 selected')).toBeTruthy();
    expect(screen.getByText('2026-10-15 selected')).toBeTruthy();
    expect(screen.getByText('2026-10-16 open')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    expect(screen.queryByText('2026-10-13 selected')).toBeNull();
    expect(screen.getByRole('button', { name: '2026' })).toBeTruthy();
  });

  it('keeps keyboard movement when a day has content', () => {
    render(
      <Calendar.Root aria-label="Start" locale="en-US" firstDayOfWeek={7} defaultValue={date('2026-10-13')}>
        <Calendar.Header />
        <Calendar.Grid renderDay={() => <span>note</span>} />
      </Calendar.Root>,
    );
    // Each day is named by its date, then its note.
    const press = (key: string, shiftKey = false) => {
      fireEvent.keyDown(focusedDay(), { key, shiftKey });
      return dayName(focusedDay())?.replace(/ note$/, '');
    };
    focusedDay().focus();
    expect(focusedDay().textContent).toContain('note');
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
    expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    fireEvent.click(day('Thursday, October 1, 2026'));
    expect(press('ArrowLeft')).toBe('Wednesday, September 30, 2026');
    expect(screen.getByRole('button', { name: 'September 2026' })).toBeTruthy();
    expect(focusedDay().textContent).toContain('note');
  });

  const fullDate = (iso: string) => date(iso).toLocaleString('en-US', { dateStyle: 'full' });

  it('leaves the day buttons unchanged when renderDay and showOutsideDays are off', () => {
    render(
      <>
        <Calendar.Root aria-label="Base" locale="en-US" firstDayOfWeek={7} value={date('2026-10-13')} onValueChange={() => undefined}>
          <Calendar.Header />
          <Calendar.Grid />
        </Calendar.Root>
        <Calendar.Root aria-label="Off" locale="en-US" firstDayOfWeek={7} value={date('2026-10-13')} onValueChange={() => undefined}>
          <Calendar.Header />
          <Calendar.Grid showOutsideDays={false} />
        </Calendar.Root>
      </>,
    );
    const base = within(screen.getByRole('group', { name: 'Base' })).getByRole('grid');
    const off = within(screen.getByRole('group', { name: 'Off' })).getByRole('grid');
    expect(off.querySelector('tbody')!.innerHTML).toBe(base.querySelector('tbody')!.innerHTML);
    expect(base.querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(31);
    expect(base.querySelector('tbody td')!.childElementCount).toBe(0);
    expect(base.querySelector('[data-outside]')).toBeNull();
  });

  it('spends no day ids, so a useId after a plain calendar matches one with the calendar omitted', () => {
    function Mark({ name }: { name: string }) {
      const id = useId();
      return <span data-testid={name}>{id}</span>;
    }
    const numberOf = (name: string) => {
      const text = screen.getByTestId(name).textContent ?? '';
      const match = /_r_([0-9a-v]+)_/i.exec(text);
      if (!match?.[1]) throw new Error(text);
      return Number.parseInt(match[1], 32);
    };
    render(
      <>
        <div>
          <Mark name="base-before" />
          <Mark name="base-after" />
        </div>
        <div>
          <Mark name="cal-before" />
          <Calendar.Root aria-label="Start" locale="en-US" firstDayOfWeek={7} value={date('2026-10-13')} onValueChange={() => undefined}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
          <Mark name="cal-after" />
        </div>
      </>,
    );
    const baseGap = numberOf('base-after') - numberOf('base-before');
    const heading = screen.getByRole('button', { name: 'October 2026' }).id;
    const headingNumber = Number.parseInt(/_r_([0-9a-v]+)_/i.exec(heading)?.[1] ?? '', 32);
    expect(headingNumber).toBe(numberOf('cal-before') + baseGap);
    expect(numberOf('cal-after')).toBe(headingNumber + baseGap);
  });

  it('draws outside days only when showOutsideDays is set, with or without renderDay', () => {
    const seen: string[] = [];
    const note = (day: { date: Temporal.PlainDate; outside: boolean }) => {
      seen.push(`${day.date.toString()} ${day.outside ? 'outside' : 'in'}`);
      return day.outside ? 'out' : 'in';
    };
    const month = (label: string, gridProps: { showOutsideDays?: boolean; renderDay?: typeof note }) => (
      <Calendar.Root aria-label={label} locale="en-US" firstDayOfWeek={7} value={date('2026-09-15')} onValueChange={() => undefined}>
        <Calendar.Header />
        <Calendar.Grid {...gridProps} />
      </Calendar.Root>
    );

    const { rerender } = render(month('September', {}));
    const cells = () => within(screen.getByRole('group', { name: 'September' })).getByRole('grid');
    expect(cells().querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(30);
    expect(cells().querySelector('tbody td')!.childElementCount).toBe(0);
    expect(cells().querySelector('[data-outside]')).toBeNull();
    expect(screen.queryByRole('button', { name: fullDate('2026-08-30') })).toBeNull();
    expect(screen.queryByRole('button', { name: fullDate('2026-10-03') })).toBeNull();

    seen.length = 0;
    rerender(month('September', { renderDay: note }));
    expect(seen).toHaveLength(30);
    expect(seen.some((line) => line.endsWith('outside'))).toBe(false);
    expect(screen.getAllByText('in')).toHaveLength(30);
    expect(screen.queryByText('out')).toBeNull();
    expect(cells().querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(30);
    expect(cells().querySelector('tbody td')!.childElementCount).toBe(0);
    expect(screen.queryByRole('button', { name: fullDate('2026-10-01') })).toBeNull();

    seen.length = 0;
    rerender(month('September', { showOutsideDays: true }));
    expect(seen).toHaveLength(0);
    expect(cells().querySelectorAll('[data-todae-calendar-cell]')).toHaveLength(35);
    expect(cells().querySelectorAll('[data-outside]')).toHaveLength(5);
    const leading = screen.getByRole('button', { name: fullDate('2026-08-30') });
    const trailing = screen.getByRole('button', { name: fullDate('2026-10-03') });
    expect(leading.hasAttribute('data-outside')).toBe(true);
    expect(trailing.hasAttribute('data-outside')).toBe(true);
    expect(shown(leading)).toBe('30');
    expect(shown(trailing)).toBe('3');
    expect(screen.queryByText('out')).toBeNull();

    seen.length = 0;
    rerender(month('September', { showOutsideDays: true, renderDay: note }));
    expect(seen).toHaveLength(35);
    expect(seen).toContain('2026-08-30 outside');
    expect(seen).toContain('2026-08-31 outside');
    expect(seen).toContain('2026-10-01 outside');
    expect(seen).toContain('2026-10-02 outside');
    expect(seen).toContain('2026-10-03 outside');
    expect(seen).toContain('2026-09-15 in');
    expect(day(fullDate('2026-08-30')).textContent).toContain('out');
    expect(day(fullDate('2026-10-01')).textContent).toContain('out');
    expect(day(fullDate('2026-09-15')).textContent).toContain('in');
    expect(day(fullDate('2026-09-15')).hasAttribute('data-outside')).toBe(false);
  });

  it('presses an outside day only when showOutsideDays is set', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Calendar.Root aria-label="Start" locale="en-US" firstDayOfWeek={7} value={date('2026-10-13')} onValueChange={onValueChange}>
        <Calendar.Header />
        <Calendar.Grid renderDay={() => 'note'} />
      </Calendar.Root>,
    );
    expect(screen.queryByRole('button', { name: fullDate('2026-09-27') })).toBeNull();
    rerender(
      <Calendar.Root aria-label="Start" locale="en-US" firstDayOfWeek={7} value={date('2026-10-13')} onValueChange={onValueChange}>
        <Calendar.Header />
        <Calendar.Grid showOutsideDays renderDay={() => 'note'} />
      </Calendar.Root>,
    );
    fireEvent.click(day(fullDate('2026-09-27')));
    expect(onValueChange).toHaveBeenCalledWith(date('2026-09-27'));
  });

  it('names a day with content by its date, then that content, and gives it no description', () => {
    render(
      <Calendar.Root aria-label="Start" locale="en-US" value={date('2026-10-13')} onValueChange={() => undefined}>
        <Calendar.Grid renderDay={(day) => (day.date.toString() === '2026-10-13' ? 'Review' : null)} />
      </Calendar.Root>,
    );
    const named = screen.getByRole('button', { name: 'Tuesday, October 13, 2026 Review', description: '' });
    expect(named.hasAttribute('aria-describedby')).toBe(false);
    expect(named.hasAttribute('aria-label')).toBe(false);
    expect(shown(named)).toBe('13');
    const quiet = screen.getByRole('button', { name: 'Wednesday, October 14, 2026', description: '' });
    expect(shown(quiet)).toBe('14');
  });

  it('shows the day in the locale digits its name uses', () => {
    render(
      <Calendar.Root aria-label="Start" locale="fa-IR" value={date('2026-10-13')} onValueChange={() => undefined}>
        <Calendar.Grid />
      </Calendar.Root>,
    );
    const name = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', calendar: 'gregory', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 13)));
    expect(shown(day(name))).toBe('۱۳');
  });

  it('tells renderDay which day is today inside the shown month', () => {
    const today = Temporal.Now.plainDateISO();
    const other = today.day === today.daysInMonth ? today.subtract({ days: 1 }) : today.add({ days: 1 });
    render(
      <Calendar.Root aria-label="Start" locale="en-US" value={today} onValueChange={() => undefined}>
        <Calendar.Grid renderDay={(day) => `${day.date.toString()} ${day.today ? 'today' : 'other'}`} />
      </Calendar.Root>,
    );
    expect(screen.getByText(`${today.toString()} today`)).toBeTruthy();
    expect(screen.getByText(`${other.toString()} other`)).toBeTruthy();
  });

  it('tells renderDay a day is disabled after a range first pick when the range cannot end on it', () => {
    render(
      <Calendar.Root
        aria-label="Stay"
        locale="en-US"
        firstDayOfWeek={7}
        mode="range"
        defaultMonth={Temporal.PlainYearMonth.from('2026-10')}
        value={null}
        onValueChange={() => undefined}
        isDateDisabled={(day) => day.toString() === '2026-10-15'}
      >
        <Calendar.Header />
        <Calendar.Grid renderDay={(day) => `${day.date.toString()} ${day.disabled ? 'disabled' : 'enabled'}`} />
      </Calendar.Root>,
    );
    fireEvent.click(day('Monday, October 12, 2026'));
    expect(screen.getByText('2026-10-14 enabled')).toBeTruthy();
    expect(screen.getByText('2026-10-16 disabled')).toBeTruthy();
    expect(screen.getByText('2026-10-18 disabled')).toBeTruthy();
    const past = day('Sunday, October 18, 2026') as HTMLButtonElement;
    expect(past.disabled).toBe(false);
    expect(past.getAttribute('aria-disabled')).toBe('true');
  });

  it('tells renderDay every day is disabled when Calendar.Root is disabled', () => {
    render(
      <Calendar.Root aria-label="Start" locale="en-US" disabled value={date('2026-10-13')} onValueChange={() => undefined}>
        <Calendar.Grid renderDay={(day) => (day.disabled ? 'off' : 'on')} />
      </Calendar.Root>,
    );
    expect(screen.getAllByText('off').length).toBeGreaterThan(0);
    expect(screen.queryByText('on')).toBeNull();
    expect((day('Tuesday, October 13, 2026') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says in development when renderDay returns something focusable, once, and not in production', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const told = () => error.mock.calls.filter(([message]) => String(message).includes('no keyboard path'));
    const show = (node: ReactNode, everyDay = false) => {
      error.mockClear();
      cleanup();
      render(
        <Calendar.Root aria-label="Start" locale="en-US" value={date('2026-10-13')} onValueChange={() => undefined}>
          <Calendar.Grid renderDay={(day) => (everyDay || day.date.toString() === '2026-10-13' ? node : null)} />
        </Calendar.Root>,
      );
    };
    resetWarnOnce();
    show('Review');
    expect(told()).toHaveLength(0);
    show(<a>Review</a>);
    expect(told()).toHaveLength(0);
    show(<a href="/review">Review</a>, true);
    expect(told()).toHaveLength(1);
    show(<button type="button">Review</button>, true);
    expect(told()).toHaveLength(0);
    for (const node of [
      <button key="button" type="button">
        Review
      </button>,
      <span key="tab" tabIndex={0}>
        Review
      </span>,
      <input key="input" aria-label="Note" />,
      <select key="select" aria-label="Note">
        <option>A</option>
      </select>,
      <textarea key="area" aria-label="Note" />,
      <span key="edit" contentEditable>
        Review
      </span>,
    ]) {
      resetWarnOnce();
      show(node);
      expect(told()).toHaveLength(1);
    }
    const env = process.env.NODE_ENV;
    vi.stubEnv('NODE_ENV', 'production');
    try {
      resetWarnOnce();
      show(<a href="/review">Review</a>, true);
      expect(told()).toHaveLength(0);
    } finally {
      vi.stubEnv('NODE_ENV', env ?? 'test');
    }
    vi.restoreAllMocks();
  });

  it('throws when a part renders outside Calendar.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Calendar.Grid />)).toThrow('Calendar.Grid must render inside Calendar.Root');
    vi.restoreAllMocks();
  });
});
