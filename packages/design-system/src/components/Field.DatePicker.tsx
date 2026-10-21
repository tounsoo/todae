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
import { useFieldPicker, htmlDate } from './Field.shared.js';

/** Why Field.DatePicker's calendar closed: a popover's reasons, a picked date, or the field became disabled. */
export type FieldDatePickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

export type FieldDatePickerProps = {
  /** The date, or null for none. */
  value: Temporal.PlainDate | null;
  /** Fires with the date picked in the calendar. */
  onValueChange?: (value: Temporal.PlainDate) => void;
  /** The earliest date that can be picked. */
  min?: Temporal.PlainDate;
  /** The latest date that can be picked. */
  max?: Temporal.PlainDate;
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

/**
 * A button that opens a Calendar in a popover. On its own it is the field's
 * control and shows the date, and a press elsewhere in the field opens the
 * calendar. Beside any other control but a Field.ColorPicker,
 * Field.DatePicker, Field.DateRangePicker, Field.TimePicker or
 * Field.DateTimePicker, such as a Field.TextInput to type the date in, that
 * control is the field's control instead, and the button is named from the
 * datePicker string. With `showValue={false}` the button shows only a
 * calendar glyph.
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
  showValue = true,
  open,
  defaultOpen,
  onOpenChange,
  className,
  style,
  'aria-describedby': describedBy,
  ...props
}: FieldDatePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  const textId = useDomId();
  // The button's name is not the date, so the date it shows is its description.
  const picker = useFieldPicker<'select'>({
    props: { ...props, 'aria-describedby': showValue ? mergeDescribedBy(describedBy, textId) : describedBy },
    label: strings.datePicker,
    open,
    defaultOpen,
    onOpenChange,
    style,
    // The calendar's Tab stop: the date, or else today or the nearest date in range.
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
          <span id={textId} className={styles.pickerText} data-placeholder={value ? undefined : ''}>
            {value ? isoDate(value).toLocaleString(locale, { dateStyle: 'medium', calendar: GREGORY }) : placeholder}
          </span>
        ) : null}
        <span className={styles.pickerGlyph} data-todae-glyph="" aria-hidden="true">
          {glyphOr(calendar, <CalendarGlyph />)}
        </span>
      </button>
      {/* A button sends nothing with a form, so the value goes in a hidden input. */}
      {picker.name ? (
        <input
          type="hidden"
          name={picker.name}
          value={value ? htmlDate(isoDate(value)) : ''}
          disabled={picker.disabled}
          form={picker.form}
        />
      ) : null}
      {/* Mounted while open only: a form can hold many date pickers. */}
      {picker.shown ? (
        <Popover.Root
          {...picker.popover.getPopoverProps()}
          role="dialog"
          aria-label={strings.datePicker}
          className={styles.datePickerPopover}
        >
          <CalendarParts.Root
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
