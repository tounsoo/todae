/// <reference lib="esnext.temporal" preserve="true" />
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
import { htmlDate, valueBounds } from './Field.shared.js';
import { PickerShell, type PickerBaseProps, type PickerCloseReason } from './Field.PickerShell.js';

/** Why Field.DatePicker's calendar closed: a popover's reasons, a picked date, or the field became disabled. */
export type FieldDatePickerCloseReason = PickerCloseReason;

export type FieldDatePickerProps = PickerBaseProps & {
  /** The date, or null for none. */
  value: Temporal.PlainDate | null;
  /** Fires with the date picked in the calendar. */
  onValueChange?: (value: Temporal.PlainDate) => void;
  /** The earliest date that can be picked. A form with an earlier date is invalid. */
  min?: Temporal.PlainDate;
  /** The latest date that can be picked. A form with a later date is invalid. */
  max?: Temporal.PlainDate;
  /** Returns true for a date that cannot be picked, such as a holiday. */
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  /** The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
};

/** A date as the button shows it, such as "Oct 7, 2026", and as a message names it. */
export function dateLabel(value: Temporal.PlainDate, locale: string | undefined) {
  return isoDate(value).toLocaleString(locale, { dateStyle: 'medium', calendar: GREGORY });
}

/**
 * A button that opens a Calendar in a popover and closes it on a picked date.
 * On its own it is the field's control, shows the date, and a press elsewhere
 * in the field opens the calendar. Beside any other control but a
 * Field.ColorPicker, Field.DatePicker, Field.DateRangePicker, Field.TimePicker
 * or Field.DateTimePicker, such as a Field.TextInput to type the date in, that
 * control is the field's control instead, and the button is named from the
 * datePicker string. The date goes in a native input the browser validates, so
 * `required`, `min` and `max` block a submit and Form.Root shows them. With
 * `showValue` set to false, the button shows only a calendar glyph.
 */
export function DatePicker({
  value,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
  locale,
  ...props
}: FieldDatePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  return (
    <PickerShell
      {...props}
      label={strings.datePicker}
      glyph={glyphOr(calendar, <CalendarGlyph />)}
      shown={value ? dateLabel(value, locale) : null}
      // The calendar's Tab stop: the date, or else today or the nearest date in range.
      focusSelector={CALENDAR_TAB_STOP}
      valueInput={{
        type: 'date',
        value: value ? htmlDate(isoDate(value)) : '',
        ...valueBounds(min, max, (date) => htmlDate(isoDate(date)), (date) => dateLabel(date, locale)),
      }}
    >
      {({ pick }) => (
        <CalendarParts.Root
          value={value}
          onValueChange={pick}
          min={min}
          max={max}
          isDateDisabled={isDateDisabled}
          firstDayOfWeek={firstDayOfWeek}
          locale={locale}
        >
          <CalendarParts.Header />
          <CalendarParts.Grid />
        </CalendarParts.Root>
      )}
    </PickerShell>
  );
}
