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
import { spanOf, type DateRange } from './dateRange.js';
import { htmlDateText } from './Field.shared.js';
import { PickerShell, type PickerBaseProps, type PickerCloseReason } from './Field.PickerShell.js';

/** Why Field.DateRangePicker's calendar closed: a popover's reasons, a picked range, or the field became disabled. */
export type FieldDateRangePickerCloseReason = PickerCloseReason;

export type FieldDateRangePickerProps = PickerBaseProps & {
  /** The range, or null for none. */
  value: DateRange | null;
  /** Fires with the range picked in the calendar, once its second date is picked. */
  onValueChange?: (value: DateRange) => void;
  /** The earliest date that can be picked. */
  min?: Temporal.PlainDate;
  /** The latest date that can be picked. */
  max?: Temporal.PlainDate;
  /** Returns true for a date that cannot be picked, such as a holiday. A range can't hold one. */
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  /** The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
};

const buttonFormats = /* @__PURE__ */ new Map<string, Intl.DateTimeFormat>();
function buttonFormat(locale: string | undefined) {
  const key = locale ?? '';
  let format = buttonFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', calendar: GREGORY, timeZone: 'UTC' });
    buttonFormats.set(key, format);
  }
  return format;
}

const toDate = (date: Temporal.PlainDate) => {
  const iso = isoDate(date);
  const at = new Date(Date.UTC(2000, 0, 1, 12));
  // Date.UTC would read years 0 to 99 as 1900 to 1999.
  at.setUTCFullYear(iso.year, iso.month - 1, iso.day);
  return at;
};

/**
 * A button that opens a Calendar in range mode in a popover, which closes once
 * the range's second date is picked. On its own it is the field's control,
 * shows the range, and a press elsewhere in the field opens the calendar.
 * Beside any other control but a Field.ColorPicker, Field.DatePicker,
 * Field.DateRangePicker, Field.TimePicker or Field.DateTimePicker, such as a
 * Field.TextInput to type the range in, that control is the field's control
 * instead, and the button is named from the dateRangePicker string. With
 * `showValue` set to false, the button shows only a calendar glyph. The range
 * goes in a native text input under the field's name unless another control
 * took it, as an ISO 8601 interval such as 2026-10-03/2026-10-10, so
 * `required` blocks a submit and Form.Root shows it.
 */
export function DateRangePicker({
  value,
  isDateDisabled,
  min,
  max,
  firstDayOfWeek,
  locale,
  ...props
}: FieldDateRangePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  const range = value && spanOf(value.start, value.end);
  return (
    <PickerShell
      {...props}
      label={strings.dateRangePicker}
      glyph={glyphOr(calendar, <CalendarGlyph />)}
      shown={range ? buttonFormat(locale).formatRange(toDate(range.start), toDate(range.end)) : null}
      // The calendar's Tab stop: the range's start, or else today or the nearest date in range.
      focusSelector={CALENDAR_TAB_STOP}
      valueInput={{
        type: 'text',
        value: range ? `${htmlDateText(isoDate(range.start))}/${htmlDateText(isoDate(range.end))}` : '',
      }}
    >
      {({ pick }) => (
        <CalendarParts.Root
          mode="range"
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
