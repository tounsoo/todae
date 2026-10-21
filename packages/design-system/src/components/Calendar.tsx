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
import { useControlledState } from '../hooks/useControlledState.js';
import { useAnnouncer } from '../hooks/useAnnouncer.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { useDomId } from './domId.js';
import { useFieldsetState } from './Fieldset.context.js';
import { ChevronGlyph, glyphOr } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import type { DateRange } from './dateRangeText.js';
import styles from './Calendar.module.css';

/** A day of the week as Temporal numbers it: 1 is Monday, 7 is Sunday. */
export type CalendarFirstDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Whether Calendar.Root picks one date or a range of dates. */
export type CalendarMode = 'single' | 'range';

type CalendarSharedProps = {
  /** The earliest date that can be picked. */
  min?: Temporal.PlainDate;
  /** The latest date that can be picked. */
  max?: Temporal.PlainDate;
  /** Returns true for a date that cannot be picked, such as a holiday. After a range's first pick it is also called for the days from that pick to the shown month, until one returns true; each day once, until the function, the first pick, min or max changes. */
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

/**
 * Calendar.Root's props, which follow `mode`: one date by default, or with
 * `mode="range"` a DateRange.
 */
export type CalendarRootProps =
  | (CalendarSharedProps & {
      /** One date, or with "range" a range of dates: the first pick starts it and the second ends it. Defaults to "single". */
      mode?: 'single';
      /** Controlled selected date, or null for none. Pass with onValueChange. */
      value?: Temporal.PlainDate | null;
      /** Initial selected date when uncontrolled. */
      defaultValue?: Temporal.PlainDate | null;
      /** Fires with each date a person picks, even the one already selected. */
      onValueChange?: (value: Temporal.PlainDate) => void;
    })
  | (CalendarSharedProps & {
      /** One date, or with "range" a range of dates: the first pick starts it and the second ends it. */
      mode: 'range';
      /** Controlled selected range, or null for none. Pass with onValueChange. */
      value?: DateRange | null;
      /** Initial selected range when uncontrolled. */
      defaultValue?: DateRange | null;
      /** Fires with the range when its second date is picked. */
      onValueChange?: (value: DateRange) => void;
    });

export type CalendarHeaderProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

export type CalendarGridProps = Omit<ComponentPropsWithRef<'table'>, 'children' | 'role'>;

type CalendarContextValue = {
  mode: CalendarMode;
  /** The selected range; in single mode the date as a one-day range. */
  value: DateRange | null;
  /** In range mode, the first pick of a range still waiting for its other end. */
  anchor: Temporal.PlainDate | null;
  /** The range the grid draws: the value, or while an anchor is set, the anchor to the hovered or focused day. */
  shown: DateRange | null;
  /** While an anchor is set, whether a range from it to the date would hold only days that can be picked. */
  reachable: (date: Temporal.PlainDate) => boolean;
  setHovered: (date: Temporal.PlainDate | null) => void;
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

/** How far from the anchor isDateDisabled has been checked, and the nearest days it ruled out. */
type ReachScan = {
  anchor: Temporal.PlainDate;
  isDateDisabled: (date: Temporal.PlainDate) => boolean;
  min: Temporal.PlainDate | undefined;
  max: Temporal.PlainDate | undefined;
  /** The earliest and latest days checked. */
  below: Temporal.PlainDate;
  above: Temporal.PlainDate;
  /** The days beside the nearest ones ruled out, once found. */
  first: Temporal.PlainDate | null;
  last: Temporal.PlainDate | null;
};

const CalendarContext = /* @__PURE__ */ createContext<CalendarContextValue | null>(null);

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

const sameRange = (a: DateRange | null, b: DateRange | null) =>
  a === b || (a !== null && b !== null && a.start.equals(b.start) && a.end.equals(b.end));

const compare = (a: Temporal.PlainDate, b: Temporal.PlainDate) => Temporal.PlainDate.compare(a, b);

/** The range in the ISO calendar, its ends in order. */
function isoRange(range: DateRange | null | undefined): DateRange | null | undefined {
  if (!range) return range;
  const start = isoDate(range.start);
  const end = isoDate(range.end);
  if (compare(start, end) > 0) return { start: end, end: start };
  // The same object when nothing changes, so a controlled value keeps its identity.
  return start === range.start && end === range.end ? range : { start, end };
}

const spanOf = (a: Temporal.PlainDate, b: Temporal.PlainDate): DateRange =>
  compare(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };

// One range per date, so a controlled date keeps one value across renders.
const oneDayRanges = /* @__PURE__ */ new WeakMap<Temporal.PlainDate, DateRange>();
function oneDay(date: Temporal.PlainDate | null | undefined) {
  if (!date) return date;
  let range = oneDayRanges.get(date);
  if (!range) {
    range = { start: date, end: date };
    oneDayRanges.set(date, range);
  }
  return range;
}

/** Either mode's value props as a range: single mode holds its date as a one-day range. */
function rangeProps({ mode, value, defaultValue, onValueChange }: CalendarRootProps) {
  if (mode === 'range') {
    return { value: isoRange(value), defaultValue: isoRange(defaultValue) ?? null, onValueChange };
  }
  return {
    value: oneDay(isoDate(value)),
    defaultValue: oneDay(isoDate(defaultValue)) ?? null,
    onValueChange: onValueChange && ((next: DateRange) => onValueChange(next.start)),
  };
}

function Root(rootProps: CalendarRootProps) {
  const {
    mode = 'single',
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    min: minProp,
    max: maxProp,
    isDateDisabled,
    defaultMonth,
    firstDayOfWeek,
    locale: localeProp,
    disabled: disabledProp,
    className,
    children,
    onKeyDown,
    ...props
  } = rootProps;
  const { disabled } = useFieldsetState({ disabled: disabledProp });
  const strings = useStrings();
  const announce = useAnnouncer();
  const [firstMode] = useState(mode);
  if (process.env.NODE_ENV !== 'production' && mode !== firstMode) {
    console.error('Calendar.Root cannot change mode after it mounts; give it a new key instead');
  }
  // Kept by value, so a min or max made anew each render recomputes nothing.
  const minText = isoDate(minProp)?.toString();
  const maxText = isoDate(maxProp)?.toString();
  const min = useMemo(() => (minText === undefined ? undefined : Temporal.PlainDate.from(minText)), [minText]);
  const max = useMemo(() => (maxText === undefined ? undefined : Temporal.PlainDate.from(maxText)), [maxText]);
  const { onValueChange, ...ends } = rangeProps(rootProps);
  const [value, setValue] = useControlledState<DateRange | null>(ends.value, ends.defaultValue);
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
    () => value?.start ?? isoDate(defaultMonth?.toPlainDate({ day: 1 })) ?? null,
  );
  const startOrToday = focusedState ?? today;
  const focused = startOrToday === null ? null : clampDate(startOrToday, min, max);
  const [anchor, setAnchor] = useState<Temporal.PlainDate | null>(null);
  const [hovered, setHovered] = useState<Temporal.PlainDate | null>(null);
  // A value from outside, such as one typed in a text input beside Field.DatePicker, moves the
  // grid to its start and drops a range in progress. The calendar's own pick leaves the grid
  // where it was picked, whether the value takes it or a controlling parent turns it down.
  const [lastValue, setLastValue] = useState(value);
  const [ownPick, setOwnPick] = useState<DateRange | null>(null);
  if (!sameRange(value, lastValue)) {
    setLastValue(value);
    setOwnPick(null);
    setAnchor(null);
    setHovered(null);
    if (value && !sameRange(value, ownPick)) setFocused(value.start);
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
  // The first and last days a range from the anchor can reach: min and max,
  // or nearer, the days beside the nearest ones isDateDisabled rules out. Only
  // the shown month's days are drawn, so days are checked only as far as it
  // reaches, and each day once while the anchor, isDateDisabled, min and max
  // stay the same.
  const shownMonth = focused?.toPlainYearMonth().toString() ?? null;
  const scan = useRef<ReachScan | null>(null);
  const reach = useMemo(() => {
    if (!anchor || shownMonth === null) return null;
    if (!isDateDisabled) return { first: min ?? null, last: max ?? null };
    let s = scan.current;
    if (!s || !s.anchor.equals(anchor) || s.isDateDisabled !== isDateDisabled || s.min !== min || s.max !== max) {
      s = scan.current = { anchor, isDateDisabled, min, max, below: anchor, above: anchor, first: null, last: null };
    }
    const month = Temporal.PlainYearMonth.from(shownMonth);
    const monthStart = month.toPlainDate({ day: 1 });
    const monthEnd = month.toPlainDate({ day: month.daysInMonth });
    const from = min && compare(min, monthStart) > 0 ? min : monthStart;
    const to = max && compare(max, monthEnd) < 0 ? max : monthEnd;
    while (!s.first && compare(s.below, from) > 0) {
      s.below = s.below.subtract({ days: 1 });
      if (isDateDisabled(s.below)) s.first = s.below.add({ days: 1 });
    }
    while (!s.last && compare(s.above, to) < 0) {
      s.above = s.above.add({ days: 1 });
      if (isDateDisabled(s.above)) s.last = s.above.subtract({ days: 1 });
    }
    return { first: s.first ?? min ?? null, last: s.last ?? max ?? null };
  }, [anchor, isDateDisabled, max, min, shownMonth]);
  const reachable = useCallback(
    (date: Temporal.PlainDate) =>
      reach !== null &&
      !(reach.first && compare(date, reach.first) < 0) &&
      !(reach.last && compare(date, reach.last) > 0),
    [reach],
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
      if (disabled || unavailable(date) || (anchor && !reachable(date))) return;
      setFocused(date);
      // In single mode a pick is a whole range of one day.
      if (mode === 'range' && !anchor) {
        setAnchor(date);
        announce(strings.pickEndDate);
        return;
      }
      // Reported even when it is the value already selected.
      const next = spanOf(anchor ?? date, date);
      setAnchor(null);
      setHovered(null);
      setOwnPick(next);
      setValue(next);
      onValueChange?.(next);
    },
    [anchor, announce, disabled, mode, onValueChange, reachable, setValue, strings.pickEndDate, unavailable],
  );
  const shown = useMemo(() => {
    if (!anchor) return value;
    const end = hovered ?? focused;
    return end && reachable(end) ? spanOf(anchor, end) : { start: anchor, end: anchor };
  }, [anchor, focused, hovered, reachable, value]);

  const ctx = useMemo(
    () => ({
      mode,
      value,
      anchor,
      shown,
      reachable,
      setHovered,
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
      mode,
      value,
      anchor,
      shown,
      reachable,
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
        onKeyDown={composeHandlers(onKeyDown, (event) => {
          if (event.key !== 'Escape' || !anchor) return;
          // Only the range in progress goes. Stopping the key here keeps it from the
          // document, where a popover around the calendar listens for Escape to close.
          event.preventDefault();
          event.stopPropagation();
          setAnchor(null);
          setHovered(null);
        })}
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

const yearFormats = /* @__PURE__ */ new Map<string, Intl.NumberFormat>();
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

function DayGrid({ className, onKeyDown, onPointerLeave, ref: refProp, ...props }: CalendarGridProps) {
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
    // The keys take the range's preview from the pointer.
    cal.setHovered(null);
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
      aria-multiselectable={cal.mode === 'range' || undefined}
      className={cx(styles.grid, className)}
      onKeyDown={composeHandlers(onKeyDown, onDayKeyDown)}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        cal.setHovered(null);
      }}
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
  const { shown, anchor } = cal;
  const inShown = shown !== null && compare(date, shown.start) >= 0 && compare(date, shown.end) <= 0;
  const rangeStart = inShown && date.equals(shown.start);
  const rangeEnd = inShown && date.equals(shown.end);
  // While a range waits for its end, only the anchor is picked.
  const selected = anchor ? date.equals(anchor) : rangeStart || rangeEnd;
  const range = cal.mode === 'range';
  const outOfRange = cal.outOfRange(date);
  const unavailable = cal.unavailable(date);
  const unreachable = anchor !== null && !unavailable && !cal.reachable(date);
  const isToday = cal.today !== null && date.equals(cal.today);
  return (
    <td aria-selected={(anchor ? selected : inShown) ? true : undefined}>
      <button
        type="button"
        className={styles.day}
        tabIndex={cal.focused !== null && date.equals(cal.focused) ? 0 : -1}
        // Outside min and max a day is disabled, as the keys never reach it;
        // one ruled out by isDateDisabled, or past one from a range's first
        // pick, still takes focus, to be read.
        disabled={cal.disabled || outOfRange}
        aria-disabled={(unavailable && !outOfRange) || unreachable ? true : undefined}
        aria-current={isToday ? 'date' : undefined}
        aria-label={date.toLocaleString(cal.locale, { dateStyle: 'full', calendar: GREGORY })}
        data-selected={selected ? '' : undefined}
        data-in-range={range && inShown && !rangeStart && !rangeEnd ? '' : undefined}
        data-range-start={range && rangeStart ? '' : undefined}
        data-range-end={range && rangeEnd ? '' : undefined}
        data-unavailable={unavailable ? '' : undefined}
        data-todae-calendar-cell=""
        onPointerEnter={anchor ? () => cal.setHovered(date) : undefined}
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
      aria-multiselectable={cal.mode === 'range' || undefined}
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
  // In range mode, every year the range touches.
  const selected = cal.value !== null && cal.value.start.year <= year && year <= cal.value.end.year;
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
