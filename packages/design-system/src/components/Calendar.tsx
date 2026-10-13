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
export type CalendarDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CalendarRootProps = {
  /** Controlled selected date, or null for none. Pass with onValueChange. */
  value?: Temporal.PlainDate | null;
  /** Initial selected date when uncontrolled. */
  defaultValue?: Temporal.PlainDate | null;
  /** Fires with the date a person picks. */
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
  firstDayOfWeek?: CalendarDayOfWeek;
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
  firstDay: CalendarDayOfWeek;
  disabled: boolean;
  headingId: string;
  /** Set when the next render should move DOM focus to the focused date. */
  focusRequest: RefObject<boolean>;
  moveFocus: (date: Temporal.PlainDate, focus: boolean) => void;
  select: (date: Temporal.PlainDate) => void;
  /** Outside min and max, or ruled out by isDateDisabled. */
  unavailable: (date: Temporal.PlainDate) => boolean;
  canShow: (month: Temporal.PlainYearMonth) => boolean;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendar(part: string): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error(`Calendar.${part} must render inside Calendar.Root`);
  return ctx;
}

type WeekInfoLocale = Intl.Locale & { getWeekInfo?: () => { firstDay: number } };

function localeFirstDay(locale: string): CalendarDayOfWeek {
  try {
    const day = (new Intl.Locale(locale) as WeekInfoLocale).getWeekInfo?.().firstDay;
    if (day && day >= 1 && day <= 7) return day as CalendarDayOfWeek;
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

const same = (a: Temporal.PlainDate | null, b: Temporal.PlainDate | null) =>
  a === b || (a !== null && b !== null && a.equals(b));

function Root({
  value: valueProp,
  defaultValue,
  onValueChange,
  min,
  max,
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
  const [value, setValue] = useControlledValue<Temporal.PlainDate | null>(
    valueProp,
    defaultValue ?? null,
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
    () => value ?? defaultMonth?.toPlainDate({ day: 1 }) ?? null,
  );
  const start = focusedState ?? today;
  const focused = start === null ? null : clampDate(start, min, max);
  // A value from outside, such as one typed in a Field.DateInput, moves the
  // grid to it.
  const [lastValue, setLastValue] = useState(value);
  if (!same(value, lastValue)) {
    setLastValue(value);
    if (value) setFocused(value);
  }
  const focusRequest = useRef(false);
  const headingId = useDomId();

  const unavailable = useCallback(
    (date: Temporal.PlainDate) =>
      (min !== undefined && Temporal.PlainDate.compare(date, min) < 0) ||
      (max !== undefined && Temporal.PlainDate.compare(date, max) > 0) ||
      Boolean(isDateDisabled?.(date)),
    [isDateDisabled, max, min],
  );
  const canShow = useCallback(
    (month: Temporal.PlainYearMonth) =>
      !(min && Temporal.PlainYearMonth.compare(month, min.toPlainYearMonth()) < 0) &&
      !(max && Temporal.PlainYearMonth.compare(month, max.toPlainYearMonth()) > 0),
    [max, min],
  );
  const moveFocus = useCallback(
    (date: Temporal.PlainDate, focus: boolean) => {
      focusRequest.current = focus;
      setFocused(clampDate(date, min, max));
    },
    [max, min],
  );
  const select = useCallback(
    (date: Temporal.PlainDate) => {
      if (disabled || unavailable(date)) return;
      setFocused(date);
      if (!same(date, value)) setValue(date);
    },
    [disabled, setValue, unavailable, value],
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
      unavailable,
      canShow,
    }),
    [value, focused, today, locale, firstDay, disabled, headingId, moveFocus, select, unavailable, canShow],
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
 * The month and year, announced as they change, between buttons for the
 * previous and next month. A month button stays focusable at the end of the
 * range, with aria-disabled, so focus does not drop to the page.
 */
function Header({ className, ...props }: CalendarHeaderProps) {
  const cal = useCalendar('Header');
  const strings = useStrings();
  const { chevron } = useGlyphs();
  const { focused } = cal;
  const month = focused?.toPlainYearMonth() ?? null;
  const nav = (dir: 'previous' | 'next') => {
    const months = dir === 'previous' ? -1 : 1;
    const next = month?.add({ months }) ?? null;
    const blocked = next === null || !cal.canShow(next);
    return (
      <button
        type="button"
        className={styles.nav}
        data-direction={dir}
        aria-label={dir === 'previous' ? strings.previousMonth : strings.nextMonth}
        aria-disabled={blocked ? true : undefined}
        disabled={cal.disabled}
        onClick={() => {
          if (blocked || cal.disabled || !focused) return;
          // Keep the day of the month, as far as the next month has it.
          cal.moveFocus(next.toPlainDate({ day: Math.min(focused.day, next.daysInMonth) }), false);
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
      <span id={cal.headingId} className={styles.heading} aria-live="polite">
        {focused?.toLocaleString(cal.locale, { month: 'long', year: 'numeric' })}
      </span>
      {nav('next')}
    </div>
  );
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
 * year. Left and Right swap in a right-to-left page.
 */
function Grid({ className, onKeyDown, ref: refProp, ...props }: CalendarGridProps) {
  const cal = useCalendar('Grid');
  const ref = useRef<HTMLTableElement>(null);
  const composedRef = useComposedRefs(ref, refProp);
  const { focused, firstDay, locale, focusRequest } = cal;

  useLayoutEffect(() => {
    if (!focusRequest.current) return;
    focusRequest.current = false;
    ref.current?.querySelector<HTMLButtonElement>('[data-todae-calendar-day][tabindex="0"]')?.focus();
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
    const day = event.target instanceof HTMLElement ? event.target.closest('[data-todae-calendar-day]') : null;
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
      aria-labelledby={props['aria-label'] ? undefined : props['aria-labelledby'] ?? cal.headingId}
      className={cx(styles.grid, className)}
      onKeyDown={composeHandlers(onKeyDown, onDayKeyDown)}
    >
      <thead>
        <tr>
          {weekdays.map((day) => (
            <th
              key={day.dayOfWeek}
              scope="col"
              abbr={day.toLocaleString(locale, { weekday: 'long' })}
              className={styles.weekday}
            >
              {day.toLocaleString(locale, { weekday: 'short' })}
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
  const unavailable = cal.unavailable(date);
  const isToday = cal.today !== null && date.equals(cal.today);
  return (
    <td aria-selected={selected ? true : undefined}>
      <button
        type="button"
        className={styles.day}
        tabIndex={cal.focused !== null && date.equals(cal.focused) ? 0 : -1}
        disabled={cal.disabled}
        aria-disabled={unavailable ? true : undefined}
        aria-current={isToday ? 'date' : undefined}
        aria-label={date.toLocaleString(cal.locale, { dateStyle: 'full' })}
        data-selected={selected ? '' : undefined}
        data-todae-calendar-day=""
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          // A click also moves the Tab stop, even to a date that can't be picked.
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

export const Calendar = { Root, Header, Grid } as const;
