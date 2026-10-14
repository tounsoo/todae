/// <reference lib="esnext.temporal" preserve="true" />
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState';
import { useGlyphs } from '../providers/GlyphsProvider';
import { useStrings } from '../providers/StringsProvider';
import { useDomId } from './domId';
import { useFieldsetState } from './Fieldset.context';
import { ChevronGlyph, glyphOr } from './glyphs';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Calendar.module.css';

/** A day of the week as Temporal numbers it: 1 is Monday, 7 is Sunday. */
export type CalendarFirstDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CalendarRootProps = {
  /** Controlled selected date, or null for none. Pass with onValueChange. */
  value?: Temporal.PlainDate | null;
  /** Initial selected date when uncontrolled. */
  defaultValue?: Temporal.PlainDate | null;
  /** Fires with each date a person picks, even the one already selected. */
  onValueChange?: (value: Temporal.PlainDate) => void;
  /** The earliest date that can be picked. */
  min?: Temporal.PlainDate;
  /** The latest date that can be picked. */
  max?: Temporal.PlainDate;
  /** Returns true for a date that cannot be picked, such as a holiday. */
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  /** The month shown first when there is no value. Today's month when not set. */
  defaultMonth?: Temporal.PlainYearMonth;
  /** The first column of the grid, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** The locale for month and weekday names, such as "ko". The browser's own when not set. */
  locale?: string;
  /** Stops every part from changing the date or month. Also set by a disabled Fieldset. */
  disabled?: boolean;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'defaultValue' | 'onChange'>;

export type CalendarHeaderProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

export type CalendarGridProps = Omit<ComponentPropsWithRef<'table'>, 'children' | 'role'>;

type CalendarContextValue = {
  value: Temporal.PlainDate | null;
  /**
   * The date that holds the grid's Tab stop. Its month is the month shown.
   * Null in a server render and hydration with no value or defaultMonth.
   */
  focused: Temporal.PlainDate | null;
  /** Null in a server render and hydration. */
  today: Temporal.PlainDate | null;
  locale: string;
  firstDay: CalendarFirstDayOfWeek;
  disabled: boolean;
  headingId: string;
  /** Set when the next render should move DOM focus to the focused date. */
  focusRequest: RefObject<boolean>;
  moveFocus: (date: Temporal.PlainDate, focus: boolean) => void;
  select: (date: Temporal.PlainDate) => void;
  /** Outside min and max: such a day is a disabled button. */
  outOfRange: (date: Temporal.PlainDate) => boolean;
  /** Outside min and max, or ruled out by isDateDisabled. */
  unavailable: (date: Temporal.PlainDate) => boolean;
  /** Whether a Calendar.Header is mounted to label the grid. */
  hasHeader: boolean;
  setHasHeader: (has: boolean) => void;
  canShow: (month: Temporal.PlainYearMonth) => boolean;
  /** Whether the grid shows the month's days or a page of years to pick from. */
  view: CalendarView;
  setView: (view: CalendarView) => void;
  /** Whether a year can be picked: in min and max, and in the months Temporal can show. */
  yearInRange: (year: number) => boolean;
  /** The year within min, max and Temporal's range nearest to the year. */
  clampYear: (year: number) => number;
  /** Moves to the year, keeping the month and day where it can. */
  moveToYear: (year: number, focus: boolean) => void;
};

type CalendarView = 'days' | 'years';

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendar(part: string): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error(`Calendar.${part} must render inside Calendar.Root`);
  return ctx;
}

// Browsers ship the method; Node 22 and older Chromium and Safari, the accessor.
type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

function localeFirstDay(locale: string): CalendarFirstDayOfWeek {
  try {
    const info = new Intl.Locale(locale) as WeekInfoLocale;
    const day = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    if (day && day >= 1 && day <= 7) return day as CalendarFirstDayOfWeek;
  } catch {
    // A locale Intl cannot read keeps the default.
  }
  return 7;
}

function clampDate(date: Temporal.PlainDate, min?: Temporal.PlainDate, max?: Temporal.PlainDate) {
  if (min && Temporal.PlainDate.compare(date, min) < 0) return min;
  if (max && Temporal.PlainDate.compare(date, max) > 0) return max;
  return date;
}

// Today as an ISO string, so the store's snapshot compares by value. A server
// render and hydration have no today.
const subscribeNothing = () => () => {};
const todayNow = () => Temporal.Now.plainDateISO().toString();
const todayOnServer = () => null;

/** The day or year that holds the grid's Tab stop. */
export const CALENDAR_TAB_STOP = '[data-todae-calendar-cell][tabindex="0"]';

/** The grid is laid out in ISO months, so names come from the Gregorian calendar whatever the locale's own. */
export const GREGORY = 'gregory';

/**
 * The date in the ISO calendar, which the grid is laid out in. A date in
 * another calendar, such as Japanese, names the same day.
 */
export function isoDate<T extends Temporal.PlainDate | null | undefined>(date: T): T {
  return (date && date.calendarId !== 'iso8601' ? date.withCalendar('iso8601') : date) as T;
}

const same = (a: Temporal.PlainDate | null, b: Temporal.PlainDate | null) =>
  a === b || (a !== null && b !== null && a.equals(b));

function Root({
  value: valueProp,
  defaultValue,
  onValueChange,
  min: minProp,
  max: maxProp,
  isDateDisabled,
  defaultMonth,
  firstDayOfWeek,
  locale: localeProp,
  disabled: disabledProp,
  className,
  children,
  ...props
}: CalendarRootProps) {
  const { disabled } = useFieldsetState({ disabled: disabledProp });
  const min = isoDate(minProp);
  const max = isoDate(maxProp);
  const [value, setValue] = useControlledValue<Temporal.PlainDate | null>(
    isoDate(valueProp),
    isoDate(defaultValue) ?? null,
    onValueChange as ((next: Temporal.PlainDate | null) => void) | undefined,
  );
  const todayText = useSyncExternalStore(subscribeNothing, todayNow, todayOnServer);
  const today = useMemo(() => (todayText === null ? null : Temporal.PlainDate.from(todayText)), [todayText]);
  const locale = useMemo(
    () => localeProp ?? new Intl.DateTimeFormat().resolvedOptions().locale,
    [localeProp],
  );
  const firstDay = firstDayOfWeek ?? localeFirstDay(locale);
  // Null until something sets it: then the grid starts on today, which a
  // server render and hydration do not know.
  const [focusedState, setFocused] = useState<Temporal.PlainDate | null>(
    () => value ?? isoDate(defaultMonth?.toPlainDate({ day: 1 })) ?? null,
  );
  const start = focusedState ?? today;
  const focused = start === null ? null : clampDate(start, min, max);
  // A value from outside, such as one typed in a text input beside Field.DatePicker, moves the
  // grid to it.
  const [lastValue, setLastValue] = useState(value);
  if (!same(value, lastValue)) {
    setLastValue(value);
    if (value) setFocused(value);
  }
  const focusRequest = useRef(false);
  const headingId = useDomId();

  const [hasHeader, setHasHeader] = useState(false);
  const outOfRange = useCallback(
    (date: Temporal.PlainDate) =>
      (min !== undefined && Temporal.PlainDate.compare(date, min) < 0) ||
      (max !== undefined && Temporal.PlainDate.compare(date, max) > 0),
    [max, min],
  );
  const unavailable = useCallback(
    (date: Temporal.PlainDate) => outOfRange(date) || Boolean(isDateDisabled?.(date)),
    [isDateDisabled, outOfRange],
  );
  const canShow = useCallback(
    (month: Temporal.PlainYearMonth) =>
      !(min && Temporal.PlainYearMonth.compare(month, min.toPlainYearMonth()) < 0) &&
      !(max && Temporal.PlainYearMonth.compare(month, max.toPlainYearMonth()) > 0),
    [max, min],
  );
  const moveFocus = useCallback(
    (date: Temporal.PlainDate, focus: boolean) => {
      const next = clampDate(date, min, max);
      // At a bound nothing changes and nothing renders, so ask for no focus
      // a later render would act on.
      if (focused !== null && next.equals(focused)) return;
      focusRequest.current = focus;
      setFocused(next);
    },
    [focused, max, min],
  );
  const [view, setView] = useState<CalendarView>('days');
  const firstYear = Math.max(min?.year ?? FIRST_YEAR, FIRST_YEAR);
  const lastYear = Math.min(max?.year ?? LAST_YEAR, LAST_YEAR);
  const yearInRange = useCallback(
    (year: number) => year >= firstYear && year <= lastYear,
    [firstYear, lastYear],
  );
  const clampYear = useCallback(
    (year: number) => Math.min(Math.max(year, firstYear), lastYear),
    [firstYear, lastYear],
  );
  const moveToYear = useCallback(
    (year: number, focus: boolean) => {
      if (!focused) return;
      const firstDay = Temporal.PlainDate.from(FIRST_DAY);
      const lastDay = Temporal.PlainDate.from(LAST_DAY);
      let date: Temporal.PlainDate;
      try {
        date = focused.with({ year });
      } catch {
        // Past Temporal's range.
        date = year < focused.year ? firstDay : lastDay;
      }
      // moveFocus then keeps the date within min and max.
      moveFocus(clampDate(date, firstDay, lastDay), focus);
    },
    [focused, moveFocus],
  );
  const select = useCallback(
    (date: Temporal.PlainDate) => {
      if (disabled || unavailable(date)) return;
      setFocused(date);
      // A pick is reported even when it is the date already selected.
      setValue(date);
    },
    [disabled, setValue, unavailable],
  );

  const ctx = useMemo(
    () => ({
      value,
      focused,
      today,
      locale,
      firstDay,
      disabled,
      headingId,
      focusRequest,
      moveFocus,
      select,
      outOfRange,
      unavailable,
      canShow,
      hasHeader,
      setHasHeader,
      view,
      setView,
      yearInRange,
      clampYear,
      moveToYear,
    }),
    [
      value,
      focused,
      today,
      locale,
      firstDay,
      disabled,
      headingId,
      moveFocus,
      select,
      outOfRange,
      unavailable,
      canShow,
      hasHeader,
      view,
      yearInRange,
      clampYear,
      moveToYear,
    ],
  );
  return (
    <CalendarContext.Provider value={ctx}>
      <div
        {...props}
        role="group"
        data-disabled={disabled ? '' : undefined}
        className={cx(styles.root, className)}
      >
        {children}
      </div>
    </CalendarContext.Provider>
  );
}

/**
 * The month and year between buttons for the previous and next month. The
 * month and year is a button that switches the grid to a page of years and
 * back; on that page the buttons go to the previous and next page. A month
 * button stays focusable at the end of the range, with aria-disabled, so focus
 * does not drop to the page.
 */
function Header({ className, ...props }: CalendarHeaderProps) {
  const cal = useCalendar('Header');
  const strings = useStrings();
  const { chevron } = useGlyphs();
  const { focused, setHasHeader, setView, view } = cal;
  useLayoutEffect(() => {
    setHasHeader(true);
    return () => {
      setHasHeader(false);
      // Only the header leads back from the years.
      setView('days');
    };
  }, [setHasHeader, setView]);
  const years = view === 'years';
  const page = focused ? yearPage(focused.year) : null;
  const month = focused?.toPlainYearMonth() ?? null;
  const nav = (dir: 'previous' | 'next') => {
    const step = dir === 'previous' ? -1 : 1;
    let blocked: boolean;
    let go: () => void;
    if (years) {
      const target = page === null ? null : page + step * YEARS_PER_PAGE;
      blocked =
        target === null ||
        !Array.from({ length: YEARS_PER_PAGE }, (_, index) => target + index).some(cal.yearInRange);
      go = () => cal.moveToYear(focused!.year + step * YEARS_PER_PAGE, false);
    } else {
      const next = month?.add({ months: step }) ?? null;
      blocked = next === null || !cal.canShow(next);
      // Keep the day of the month, as far as the next month has it.
      go = () => cal.moveFocus(next!.toPlainDate({ day: Math.min(focused!.day, next!.daysInMonth) }), false);
    }
    return (
      <button
        type="button"
        className={styles.nav}
        data-direction={dir}
        aria-label={
          years
            ? dir === 'previous'
              ? strings.previousYears
              : strings.nextYears
            : dir === 'previous'
              ? strings.previousMonth
              : strings.nextMonth
        }
        aria-disabled={blocked ? true : undefined}
        disabled={cal.disabled}
        onClick={() => {
          if (blocked || cal.disabled || !focused) return;
          go();
        }}
      >
        <span className={styles.navGlyph} data-todae-glyph="" aria-hidden="true">
          {glyphOr(chevron, <ChevronGlyph />)}
        </span>
      </button>
    );
  };
  return (
    <div {...props} className={cx(styles.header, className)}>
      {nav('previous')}
      {/* Announced as it changes. */}
      <span aria-live="polite">
        <button
          type="button"
          id={cal.headingId}
          className={styles.heading}
          aria-expanded={years}
          disabled={cal.disabled || !focused}
          onClick={() => cal.setView(years ? 'days' : 'years')}
        >
          {focused
            ? years
              ? yearFormat(cal.locale).formatRange(page!, page! + YEARS_PER_PAGE - 1)
              : focused.toLocaleString(cal.locale, { month: 'long', year: 'numeric', calendar: GREGORY })
            : null}
          <span className={styles.headingGlyph} data-todae-glyph="" aria-hidden="true">
            {glyphOr(chevron, <ChevronGlyph />)}
          </span>
        </button>
      </span>
      {nav('next')}
    </div>
  );
}

const YEARS_PER_PAGE = 12;
const YEARS_PER_ROW = 4;
// Temporal's first and last years.
const FIRST_YEAR = -271821;
const LAST_YEAR = 275760;
// The first and last days of the months the header can show: it names the months
// either side, which Temporal cannot reach from the months at the ends of its range.
const FIRST_DAY = '-271821-06-01';
const LAST_DAY = '+275760-08-31';

/** The first year of the page of years that holds the year. */
const yearPage = (year: number) => year - (((year % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE);

const yearFormats = new Map<string, Intl.NumberFormat>();
function yearFormat(locale: string) {
  let format = yearFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { useGrouping: false });
    yearFormats.set(locale, format);
  }
  return format;
}

const startOfWeek = (date: Temporal.PlainDate, firstDay: number) =>
  date.subtract({ days: (date.dayOfWeek - firstDay + 7) % 7 });

// Any whole week names the weekdays.
const WEEK_ISO = '2024-01-07';
let week: Temporal.PlainDate | undefined;
const weekAnchor = () => (week ??= Temporal.PlainDate.from(WEEK_ISO));

/**
 * The days of the shown month as a grid, one week to a row, following the
 * ARIA date picker grid: one Tab stop, arrow keys by day and week, Home and
 * End to the week's ends, Page Up and Page Down by month, and with Shift by
 * year. Left and Right swap in a right-to-left page. While Calendar.Header
 * shows the years, it is a page of twelve years in the same pattern instead.
 */
function Grid(props: CalendarGridProps) {
  const cal = useCalendar('Grid');
  return cal.view === 'years' ? <YearGrid {...props} /> : <DayGrid {...props} />;
}

function DayGrid({ className, onKeyDown, ref: refProp, ...props }: CalendarGridProps) {
  const cal = useCalendar('Grid');
  const ref = useRef<HTMLTableElement>(null);
  const composedRef = useComposedRefs(ref, refProp);
  const { focused, firstDay, locale, focusRequest } = cal;

  useLayoutEffect(() => {
    if (!focusRequest.current) return;
    focusRequest.current = false;
    ref.current?.querySelector<HTMLButtonElement>(CALENDAR_TAB_STOP)?.focus();
  });

  // With no date to start from yet (a server render), the grid has no weeks.
  const cells: (Temporal.PlainDate | null)[] = [];
  if (focused) {
    const month = focused.toPlainYearMonth();
    const first = month.toPlainDate({ day: 1 });
    for (let i = (first.dayOfWeek - firstDay + 7) % 7; i > 0; i--) cells.push(null);
    for (let i = 0; i < month.daysInMonth; i++) cells.push(first.add({ days: i }));
    while (cells.length % 7 !== 0) cells.push(null);
  }
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const weekStart = startOfWeek(weekAnchor(), firstDay);
  const weekdays = Array.from({ length: 7 }, (_, i) => weekStart.add({ days: i }));

  const onDayKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const day = event.target instanceof HTMLElement ? event.target.closest('[data-todae-calendar-cell]') : null;
    if (!day || !focused || event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(day).direction === 'rtl';
    let next: Temporal.PlainDate;
    switch (event.key) {
      case 'ArrowLeft':
        next = focused.add({ days: rtl ? 1 : -1 });
        break;
      case 'ArrowRight':
        next = focused.add({ days: rtl ? -1 : 1 });
        break;
      case 'ArrowUp':
        next = focused.subtract({ weeks: 1 });
        break;
      case 'ArrowDown':
        next = focused.add({ weeks: 1 });
        break;
      case 'Home':
        next = startOfWeek(focused, firstDay);
        break;
      case 'End':
        next = startOfWeek(focused, firstDay).add({ days: 6 });
        break;
      case 'PageUp':
        next = focused.subtract(event.shiftKey ? { years: 1 } : { months: 1 });
        break;
      case 'PageDown':
        next = focused.add(event.shiftKey ? { years: 1 } : { months: 1 });
        break;
      default:
        return;
    }
    event.preventDefault();
    cal.moveFocus(next, true);
  };

  return (
    <table
      {...props}
      ref={composedRef}
      role="grid"
      aria-labelledby={
        props['aria-label'] ? undefined : props['aria-labelledby'] ?? (cal.hasHeader ? cal.headingId : undefined)
      }
      className={cx(styles.grid, className)}
      onKeyDown={composeHandlers(onKeyDown, onDayKeyDown)}
    >
      <thead>
        <tr>
          {weekdays.map((day) => (
            <th
              key={day.dayOfWeek}
              scope="col"
              abbr={day.toLocaleString(locale, { weekday: 'long', calendar: GREGORY })}
              className={styles.weekday}
            >
              {day.toLocaleString(locale, { weekday: 'short', calendar: GREGORY })}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, row) => (
          <tr key={row}>
            {week.map((date, col) =>
              date === null ? (
                <td key={col} />
              ) : (
                <Day key={col} date={date} />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Day({ date }: { date: Temporal.PlainDate }) {
  const cal = useCalendar('Grid');
  const selected = cal.value !== null && date.equals(cal.value);
  const outOfRange = cal.outOfRange(date);
  const unavailable = cal.unavailable(date);
  const isToday = cal.today !== null && date.equals(cal.today);
  return (
    <td aria-selected={selected ? true : undefined}>
      <button
        type="button"
        className={styles.day}
        tabIndex={cal.focused !== null && date.equals(cal.focused) ? 0 : -1}
        // Outside min and max a day is disabled, as the keys never reach it;
        // one ruled out by isDateDisabled still takes focus, to be read.
        disabled={cal.disabled || outOfRange}
        aria-disabled={unavailable && !outOfRange ? true : undefined}
        aria-current={isToday ? 'date' : undefined}
        aria-label={date.toLocaleString(cal.locale, { dateStyle: 'full', calendar: GREGORY })}
        data-selected={selected ? '' : undefined}
        data-unavailable={unavailable ? '' : undefined}
        data-todae-calendar-cell=""
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          // A click also moves the Tab stop, even to a date isDateDisabled rules out.
          cal.moveFocus(date, false);
          cal.select(date);
          event.currentTarget.focus();
        }}
      >
        {date.day}
      </button>
    </td>
  );
}

/**
 * A page of years, four to a row, in the same grid pattern as the days: arrow
 * keys by year and row, Home and End to the row's ends, Page Up and Page Down
 * by page. Picking a year shows its month again, with the month and day kept
 * where they can be.
 */
function YearGrid({ className, onKeyDown, ref: refProp, ...props }: CalendarGridProps) {
  const cal = useCalendar('Grid');
  const ref = useRef<HTMLTableElement>(null);
  const composedRef = useComposedRefs(ref, refProp);
  const { focused, focusRequest } = cal;

  useLayoutEffect(() => {
    if (!focusRequest.current) return;
    focusRequest.current = false;
    ref.current?.querySelector<HTMLButtonElement>(CALENDAR_TAB_STOP)?.focus();
  });

  const page = focused ? yearPage(focused.year) : null;
  const rows =
    page === null
      ? []
      : Array.from({ length: YEARS_PER_PAGE / YEARS_PER_ROW }, (_, row) =>
          Array.from({ length: YEARS_PER_ROW }, (_, col) => page + row * YEARS_PER_ROW + col),
        );

  const onYearKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const cell = event.target instanceof HTMLElement ? event.target.closest('[data-todae-calendar-cell]') : null;
    if (!cell || !focused || event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(cell).direction === 'rtl';
    const year = focused.year;
    const rowStart = year - (year - yearPage(year)) % YEARS_PER_ROW;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = year + (rtl ? 1 : -1);
        break;
      case 'ArrowRight':
        next = year + (rtl ? -1 : 1);
        break;
      case 'ArrowUp':
        next = year - YEARS_PER_ROW;
        break;
      case 'ArrowDown':
        next = year + YEARS_PER_ROW;
        break;
      case 'Home':
        next = rowStart;
        break;
      case 'End':
        next = rowStart + YEARS_PER_ROW - 1;
        break;
      case 'PageUp':
        next = year - YEARS_PER_PAGE;
        break;
      case 'PageDown':
        next = year + YEARS_PER_PAGE;
        break;
      default:
        return;
    }
    event.preventDefault();
    // Stop at min and max, as the days do. Staying put keeps the month and day.
    const target = cal.clampYear(next);
    if (target !== year) cal.moveToYear(target, true);
  };

  return (
    <table
      {...props}
      ref={composedRef}
      role="grid"
      aria-labelledby={
        props['aria-label'] ? undefined : props['aria-labelledby'] ?? (cal.hasHeader ? cal.headingId : undefined)
      }
      className={cx(styles.grid, className)}
      onKeyDown={composeHandlers(onKeyDown, onYearKeyDown)}
    >
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((year) => (
              <Year key={year} year={year} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Year({ year }: { year: number }) {
  const cal = useCalendar('Grid');
  const selected = cal.value !== null && cal.value.year === year;
  const inRange = cal.yearInRange(year);
  return (
    <td aria-selected={selected ? true : undefined}>
      <button
        type="button"
        className={styles.year}
        tabIndex={cal.focused !== null && cal.focused.year === year ? 0 : -1}
        disabled={cal.disabled || !inRange}
        aria-current={cal.today !== null && cal.today.year === year ? 'date' : undefined}
        data-selected={selected ? '' : undefined}
        data-todae-calendar-cell=""
        onClick={() => {
          // The days take focus back, on the same date in the picked year.
          cal.moveToYear(year, true);
          cal.focusRequest.current = true;
          cal.setView('days');
        }}
      >
        {yearFormat(cal.locale).format(year)}
      </button>
    </td>
  );
}

export const Calendar = { Root, Header, Grid } as const;
