/// <reference lib="esnext.temporal" preserve="true" />
import type { ComponentPropsWithRef } from 'react';
import styles from './Field.module.css';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { CalendarGlyph, glyphOr } from './glyphs.js';
import { useStrings } from '../providers/StringsProvider.js';
import type { PopoverCloseReason } from '../hooks/usePopover.js';
import {
  Calendar as CalendarParts,
  CALENDAR_TAB_STOP,
  GREGORY,
  isoDate,
  type CalendarFirstDayOfWeek,
} from './Calendar.js';
import { htmlDate, valueBounds } from './Field.shared.js';
import { PickerShell } from './Field.PickerShell.js';

/** Why Field.DatePicker's calendar closed: a popover's reasons, a picked date, or the field became disabled. */
export type FieldDatePickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

export type FieldDatePickerProps = {
  /** The date, or null for none. */
  value: Temporal.PlainDate | null;
  /** Fires with the date picked in the calendar. */
  onValueChange?: (value: Temporal.PlainDate) => void;
  /** The earliest date that can be picked. A form with an earlier date is invalid. */
  min?: Temporal.PlainDate;
  /** The latest date that can be picked. A form with a later date is invalid. */
  max?: Temporal.PlainDate;
  /** A form with no date is invalid. */
  required?: boolean;
  /** Returns true for a date that cannot be picked, such as a holiday. */
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  /** The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** The locale for the button's date and the calendar's names, such as "ko". The browser's own when not set, so pass it when the picker renders on a server. */
  locale?: string;
  /** Shown on the button while there is no date, when showValue is true. */
  placeholder?: string;
  /** Whether the button shows the date, or the placeholder, beside its glyph. Set it to false beside a text input that shows the date. Defaults to true. */
  showValue?: boolean;
  /** Controlled open state of the calendar. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the calendar opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldDatePickerCloseReason) => void;
} & Omit<
  ComponentPropsWithRef<'button'>,
  'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'
>;

/** A date as the button shows it, such as "Oct 7, 2026", and as a message names it. */
export function dateLabel(value: Temporal.PlainDate, locale: string | undefined) {
  return isoDate(value).toLocaleString(locale, { dateStyle: 'medium', calendar: GREGORY });
}

/**
 * A button that opens a Calendar in a popover. On its own it is the field's
 * control and shows the date, and a press elsewhere in the field opens the
 * calendar. Beside any other control but a Field picker (a part that opens its
 * own popover, as this one does), such as a Field.TextInput to type the date
 * in, that control is the field's control instead, and the button is named
 * from the datePicker string. The date goes in a native input the browser
 * validates, so `required`, `min` and `max` block a submit and Form.Root shows
 * them. With `showValue={false}` the button shows only a calendar glyph.
 */
export function DatePicker({
  value,
  onValueChange,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
  locale,
  placeholder,
  ...props
}: FieldDatePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  return (
    <PickerShell
      {...props}
      label={strings.datePicker}
      glyph={glyphOr(calendar, <CalendarGlyph />)}
      text={value ? dateLabel(value, locale) : placeholder}
      empty={!value}
      // The calendar's Tab stop: the date, or else today or the nearest date in range.
      focusSelector={CALENDAR_TAB_STOP}
      valueInput={{
        type: 'date',
        value: value ? htmlDate(isoDate(value)) : '',
        ...valueBounds(min, max, (date) => htmlDate(isoDate(date)), (date) => dateLabel(date, locale)),
      }}
      popoverProps={{ role: 'dialog', 'aria-label': strings.datePicker, className: styles.datePickerPopover }}
    >
      {({ notifyValueChange, close }) => (
        <CalendarParts.Root
          value={value}
          onValueChange={(next) => {
            notifyValueChange();
            onValueChange?.(next);
            close();
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
      )}
    </PickerShell>
  );
}
