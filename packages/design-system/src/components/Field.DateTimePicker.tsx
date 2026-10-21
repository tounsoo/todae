/// <reference lib="esnext.temporal" preserve="true" />
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Field.module.css';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { CalendarGlyph, glyphOr } from './glyphs.js';
import { useStrings } from '../providers/StringsProvider.js';
import {
  Calendar as CalendarParts,
  CALENDAR_TAB_STOP,
  GREGORY,
  isoDate,
  type CalendarFirstDayOfWeek,
} from './Calendar.js';
import { htmlDateTime, valueBounds } from './Field.shared.js';
import { PickerShell, type PickerBaseProps, type PickerCloseReason } from './Field.PickerShell.js';
import { timeSlots, TimeList } from './Field.TimePicker.js';

/** Why Field.DateTimePicker's popover closed: a popover's reasons, a pick that made the value, or the field became disabled. */
export type FieldDateTimePickerCloseReason = PickerCloseReason;

export type FieldDateTimePickerProps = PickerBaseProps & {
  /** The date and time, or null for none. */
  value: Temporal.PlainDateTime | null;
  /** Fires with the date and time when a pick leaves a date the calendar offers and a time in range for it. */
  onValueChange?: (value: Temporal.PlainDateTime) => void;
  /** The earliest date and time that can be picked. A form with an earlier one is invalid. */
  min?: Temporal.PlainDateTime;
  /** The latest date and time that can be picked. A form with a later one is invalid. */
  max?: Temporal.PlainDateTime;
  /** Returns true for a date that cannot be picked, such as a holiday. */
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  /** The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** Minutes between the times in the list, from midnight. Defaults to 30. */
  step?: number;
};

const LIST = '[role="listbox"]';

// The calendar and the list of times, which hold a date or a time picked
// before the other, and report the two together.
function DateTimePanel({
  value,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
  step,
  locale,
  label,
  onValueChange,
  onDone,
}: {
  value: Temporal.PlainDateTime | null;
  min?: Temporal.PlainDateTime;
  max?: Temporal.PlainDateTime;
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  step: number;
  locale?: string;
  label: string;
  onValueChange?: (value: Temporal.PlainDateTime) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // What takes focus once a pick has rendered, after the calendar or list has moved its own.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    ref.current?.querySelector<HTMLElement>(focusNext.current)?.focus();
    focusNext.current = null;
  });
  const [date, setDate] = useState(() => (value ? isoDate(value.toPlainDate()) : null));
  const [time, setTime] = useState(() => value?.toPlainTime() ?? null);
  // A new value from outside, such as one typed beside the picker, replaces what was picked.
  const [shown, setShown] = useState(value);
  if (shown === null ? value !== null : value === null || !shown.equals(value)) {
    setShown(value);
    setDate(value ? isoDate(value.toPlainDate()) : null);
    setTime(value?.toPlainTime() ?? null);
  }
  const minDay = useMemo(() => (min ? isoDate(min.toPlainDate()) : undefined), [min]);
  const maxDate = useMemo(() => (max ? isoDate(max.toPlainDate()) : undefined), [max]);
  // The list's bounds on a date: min's time on min's date, and max's on max's.
  const boundsOn = useCallback(
    (day: Temporal.PlainDate | null): [Temporal.PlainTime | undefined, Temporal.PlainTime | undefined] => [
      min && minDay && day?.equals(minDay) ? min.toPlainTime() : undefined,
      max && maxDate && day?.equals(maxDate) ? max.toPlainTime() : undefined,
    ],
    [min, max, minDay, maxDate],
  );
  // The first date with a time in its list: min's own, or the next one when
  // its list is empty, as when min's time is past the day's last time. The
  // held time is in that list only while the held date is min's own.
  const minDate = useMemo(
    () =>
      minDay && timeSlots(step, ...boundsOn(minDay), date?.equals(minDay) ? time : null).length === 0
        ? minDay.add({ days: 1 })
        : minDay,
    [minDay, boundsOn, step, date, time],
  );
  // A date the calendar does not offer, such as one typed out of range, is no date yet.
  const offered =
    date &&
    (!minDate || Temporal.PlainDate.compare(date, minDate) >= 0) &&
    (!maxDate || Temporal.PlainDate.compare(date, maxDate) <= 0) &&
    !isDateDisabled?.(date)
      ? date
      : null;
  // Only the times on the date that are in range.
  const [minTime, maxTime] = useMemo(() => boundsOn(offered), [boundsOn, offered]);
  const report = (nextDate: Temporal.PlainDate, nextTime: Temporal.PlainTime) => {
    const next = nextDate.toPlainDateTime(nextTime);
    const inRange =
      (!min || Temporal.PlainDateTime.compare(next, min) >= 0) && (!max || Temporal.PlainDateTime.compare(next, max) <= 0);
    if (inRange) onValueChange?.(next);
    return inRange;
  };
  return (
    <div ref={ref} className={styles.dateTimePanel}>
      <CalendarParts.Root
        value={date}
        onValueChange={(next) => {
          setDate(next);
          if (time) report(next, time);
          // The time comes next.
          focusNext.current = LIST;
        }}
        min={minDate}
        max={maxDate}
        isDateDisabled={isDateDisabled}
        firstDayOfWeek={firstDayOfWeek}
        locale={locale}
      >
        <CalendarParts.Header />
        <CalendarParts.Grid />
      </CalendarParts.Root>
      <div className={styles.dateTimeTimes}>
        <TimeList
          value={time}
          step={step}
          min={minTime}
          max={maxTime}
          locale={locale}
          label={label}
          onPick={(next) => {
            setTime(next);
            if (offered) {
              if (report(offered, next)) onDone();
            } else {
              // The date comes next.
              focusNext.current = CALENDAR_TAB_STOP;
            }
          }}
        />
      </div>
    </div>
  );
}

/** The date and time as the button shows them: the date in its medium style and the time in its short style, or medium with seconds. */
function dateTimeLabel(value: Temporal.PlainDateTime, locale: string | undefined) {
  const seconds = value.second || value.millisecond || value.microsecond || value.nanosecond;
  return value
    .withCalendar('iso8601')
    .toLocaleString(locale, { dateStyle: 'medium', timeStyle: seconds ? 'medium' : 'short', calendar: GREGORY });
}

/**
 * A button that opens a Calendar and a list of times in a popover, side by
 * side, or the list under the calendar on a narrow screen. A picked date and a
 * picked time make the value, and picking a time while the calendar holds a
 * date it offers closes the popover. On its own it is the field's control,
 * shows the date and time, and a press elsewhere in the field opens the
 * popover. Beside any other control but a Field.ColorPicker, Field.DatePicker,
 * Field.DateRangePicker, Field.TimePicker or Field.DateTimePicker, such as a
 * Field.TextInput to type the date and time in, that control is the field's
 * control instead, and the button is named from the dateTimePicker string. The
 * date and time go in a native input the browser validates, so `required`,
 * `min` and `max` block a submit and Form.Root shows them. With `showValue`
 * set to false, the button shows only a calendar glyph.
 */
export function DateTimePicker({
  value,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
  step = 30,
  locale,
  ...props
}: FieldDateTimePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  return (
    <PickerShell
      {...props}
      label={strings.dateTimePicker}
      glyph={glyphOr(calendar, <CalendarGlyph />)}
      shown={value ? dateTimeLabel(value, locale) : null}
      // The calendar's Tab stop: the date, or else today or the nearest date in range.
      focusSelector={CALENDAR_TAB_STOP}
      valueInput={{
        type: 'datetime-local',
        value: value ? htmlDateTime(value) : '',
        // The list picks any time, so no step is off.
        step: 'any',
        ...valueBounds(min, max, htmlDateTime, (at) => dateTimeLabel(at, locale)),
      }}
    >
      {({ pick, close }) => (
        <DateTimePanel
          value={value}
          min={min}
          max={max}
          isDateDisabled={isDateDisabled}
          firstDayOfWeek={firstDayOfWeek}
          step={step}
          locale={locale}
          label={strings.timePicker}
          // The popover closes once a time completes the pick, not on the pick itself.
          onValueChange={(next) => pick(next, { close: false })}
          onDone={close}
        />
      )}
    </PickerShell>
  );
}
