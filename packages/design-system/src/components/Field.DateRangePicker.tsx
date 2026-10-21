/// <reference lib="esnext.temporal" preserve="true" />
import type { ComponentPropsWithRef } from 'react';
import { useDomId } from './domId.js';
import { mergeDescribedBy } from './Field.context.js';
import { cx } from './props.js';
import styles from './Field.module.css';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { CalendarGlyph, glyphOr } from './glyphs.js';
import { useStrings } from '../providers/StringsProvider.js';
import type { PopoverCloseReason } from '../hooks/usePopover.js';
import { Popover } from './Popover.js';
import {
  Calendar as CalendarParts,
  CALENDAR_TAB_STOP,
  GREGORY,
  isoDate,
  type CalendarFirstDayOfWeek,
} from './Calendar.js';
import { spanOf, type DateRange } from './dateRange.js';
import { useFieldPicker, htmlDate } from './Field.shared.js';

/** Why Field.DateRangePicker's calendar closed: a popover's reasons, a picked range, or the field became disabled. */
export type FieldDateRangePickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

export type FieldDateRangePickerProps = {
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
  /** The locale for the button's dates and the calendar's names, such as "ko". The browser's own when not set, so pass it when the picker renders on a server. */
  locale?: string;
  /** Shown on the button while there is no range, when showValue is true. */
  placeholder?: string;
  /** Whether the button shows the range, or the placeholder, beside its glyph. Set it to false beside a text input that shows the range. Defaults to true. */
  showValue?: boolean;
  /** Controlled open state of the calendar. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the calendar opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldDateRangePickerCloseReason) => void;
} & Omit<
  ComponentPropsWithRef<'button'>,
  'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'
>;

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
 * A button that opens a Calendar in range mode in a popover, which closes
 * once the range's second date is picked. On its own it is the field's
 * control and shows the range, and a press elsewhere in the field opens the
 * calendar. Beside any other control but a Field.ColorPicker,
 * Field.DatePicker, Field.DateRangePicker, Field.TimePicker or
 * Field.DateTimePicker, such as a Field.TextInput to type the range in, that
 * control is the field's control instead, and the button is named from the
 * dateRangePicker string. With `showValue={false}` the button shows only a
 * calendar glyph.
 */
export function DateRangePicker({
  value,
  onValueChange,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
  locale,
  placeholder,
  showValue = true,
  open,
  defaultOpen,
  onOpenChange,
  className,
  style,
  'aria-describedby': describedBy,
  ...props
}: FieldDateRangePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  const textId = useDomId();
  const range = value && spanOf(value.start, value.end);
  // The button's name is not the range, so the range it shows is its description.
  const picker = useFieldPicker<'select'>({
    props: { ...props, 'aria-describedby': showValue ? mergeDescribedBy(describedBy, textId) : describedBy },
    label: strings.dateRangePicker,
    open,
    defaultOpen,
    onOpenChange,
    style,
    // The calendar's Tab stop: the range's start, or else today or the nearest date in range.
    focusSelector: CALENDAR_TAB_STOP,
  });
  return (
    <>
      <button
        {...picker.triggerProps}
        type="button"
        data-todae-field-picker=""
        data-glyph-only={showValue ? undefined : ''}
        className={cx(styles.picker, className)}
      >
        {showValue ? (
          <span id={textId} className={styles.pickerText} data-placeholder={range ? undefined : ''}>
            {range ? buttonFormat(locale).formatRange(toDate(range.start), toDate(range.end)) : placeholder}
          </span>
        ) : null}
        <span className={styles.pickerGlyph} data-todae-glyph="" aria-hidden="true">
          {glyphOr(calendar, <CalendarGlyph />)}
        </span>
      </button>
      {/* A button sends nothing with a form, so the range goes in a hidden input, as an ISO 8601 interval. */}
      {picker.name ? (
        <input
          type="hidden"
          name={picker.name}
          value={range ? `${htmlDate(isoDate(range.start))}/${htmlDate(isoDate(range.end))}` : ''}
          disabled={picker.disabled}
          form={picker.form}
        />
      ) : null}
      {/* Mounted while open only, so closing drops a range's first pick. */}
      {picker.shown ? (
        <Popover.Root
          {...picker.popover.getPopoverProps()}
          role="dialog"
          aria-label={strings.dateRangePicker}
          className={styles.datePickerPopover}
        >
          <CalendarParts.Root
            mode="range"
            value={value}
            onValueChange={(next) => {
              onValueChange?.(next);
              picker.setOpen(false, 'select');
            }}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            firstDayOfWeek={firstDayOfWeek}
            locale={locale}
          >
            <CalendarParts.Header />
            <CalendarParts.Grid />
          </CalendarParts.Root>
        </Popover.Root>
      ) : null}
    </>
  );
}
