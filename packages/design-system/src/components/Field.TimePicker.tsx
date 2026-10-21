/// <reference lib="esnext.temporal" preserve="true" />
import { useMemo, useState, useSyncExternalStore, type ComponentPropsWithRef } from 'react';
import { useDomId } from './domId.js';
import { mergeDescribedBy } from './Field.context.js';
import { cx } from './props.js';
import styles from './Field.module.css';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { ClockGlyph, glyphOr } from './glyphs.js';
import { useStrings } from '../providers/StringsProvider.js';
import type { PopoverCloseReason } from '../hooks/usePopover.js';
import { Popover } from './Popover.js';
import { OptionList } from './OptionList.js';
import { formatTime } from './timeText.js';
import { useFieldPicker, htmlTime } from './Field.shared.js';
import { VisuallyHidden } from './VisuallyHidden.js';

/** Why Field.TimePicker's list closed: a popover's reasons, a picked time, or the field became disabled. */
export type FieldTimePickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

export type FieldTimePickerProps = {
  /** The time, or null for none. */
  value: Temporal.PlainTime | null;
  /** Fires with the time picked in the list. */
  onValueChange?: (value: Temporal.PlainTime) => void;
  /** The earliest time the list offers. A form with an earlier time is invalid. */
  min?: Temporal.PlainTime;
  /** The latest time the list offers. A form with a later time is invalid. */
  max?: Temporal.PlainTime;
  /** A form with no time is invalid. */
  required?: boolean;
  /** Minutes between the times in the list, from midnight. Defaults to 30. */
  step?: number;
  /** The locale for the times' text, such as "ko". The browser's own when not set, so pass it when the picker renders on a server. */
  locale?: string;
  /** Shown on the button while there is no time, when showValue is true. */
  placeholder?: string;
  /** Whether the button shows the time, or the placeholder, beside its glyph. Set it to false beside a text input that shows the time. Defaults to true. */
  showValue?: boolean;
  /** Controlled open state of the list. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the list opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldTimePickerCloseReason) => void;
} & Omit<
  ComponentPropsWithRef<'button'>,
  'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'
>;

const MINUTES_PER_DAY = 24 * 60;

/** The times every `step` minutes from midnight between `min` and `max`, with `value` among them when it is in range. */
export function timeSlots(step: number, min?: Temporal.PlainTime, max?: Temporal.PlainTime, value?: Temporal.PlainTime | null) {
  const every = Number.isFinite(step) && step >= 1 ? Math.round(step) : 30;
  const inRange = (time: Temporal.PlainTime) =>
    (!min || Temporal.PlainTime.compare(time, min) >= 0) && (!max || Temporal.PlainTime.compare(time, max) <= 0);
  const slots: Temporal.PlainTime[] = [];
  for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += every) {
    const time = new Temporal.PlainTime(Math.floor(minutes / 60), minutes % 60);
    if (inRange(time)) slots.push(time);
  }
  if (value && inRange(value) && !slots.some((time) => time.equals(value))) {
    slots.push(value);
    slots.sort(Temporal.PlainTime.compare);
  }
  return slots;
}

const subscribeNothing = () => () => {};
// Now, up to the next whole minute, as the list's times are whole minutes, as a string so the snapshot stays the same within a minute.
const nowOnClient = () => Temporal.Now.plainTimeISO().round({ smallestUnit: 'minute', roundingMode: 'ceil' }).toString();
const nowOnServer = () => null;

// The list's times, in an OptionList. It starts at the time when the list
// has it, or else at the next time from now, which a server render and
// hydration do not know, or else at its first time.
export function TimeList({
  value,
  step,
  min,
  max,
  locale,
  label,
  onPick,
}: {
  value: Temporal.PlainTime | null;
  step: number;
  min?: Temporal.PlainTime;
  max?: Temporal.PlainTime;
  locale?: string;
  label: string;
  onPick: (time: Temporal.PlainTime) => void;
}) {
  const slots = useMemo(() => timeSlots(step, min, max, value), [step, min, max, value]);
  // Formatted once per list, which can hold 1,440 times. Keyed to the
  // nanosecond, so a value between the steps stays as it is when picked.
  const options = useMemo(
    () => slots.map((time) => ({ time, key: time.toString(), label: formatTime(time, { locale }) })),
    [slots, locale],
  );
  const nowText = useSyncExternalStore(subscribeNothing, nowOnClient, nowOnServer);
  // Set once the user moves through the list.
  const [moved, setMoved] = useState<string | null>(null);
  const selected = value && slots.some((time) => time.equals(value)) ? value.toString() : null;
  const start = useMemo(() => {
    if (selected) return selected;
    const now = nowText === null ? null : Temporal.PlainTime.from(nowText);
    const next = (now && slots.find((time) => Temporal.PlainTime.compare(time, now) >= 0)) ?? slots[0];
    return next ? next.toString() : null;
  }, [selected, nowText, slots]);
  return (
    <OptionList.Root
      aria-label={label}
      value={selected}
      onValueChange={(next) => {
        const option = options.find((item) => item.key === next);
        if (option) onPick(option.time);
      }}
      activeValue={moved ?? start}
      onActiveValueChange={setMoved}
    >
      {options.map((option) => (
        <OptionList.Option key={option.key} value={option.key}>
          {option.label}
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}

/**
 * A button that opens a list of times in a popover and closes it on a picked
 * time. On its own it is the field's control and shows the time, and a press
 * elsewhere in the field opens the list. Beside any other control but a
 * Field.ColorPicker, Field.DatePicker, Field.TimePicker or Field.DateTimePicker, such as a
 * Field.TextInput to type the time in, that control is the field's control
 * instead, and the button is named from the timePicker string. The time
 * goes in a native input the browser validates, so `required`, `min` and
 * `max` block a submit and Form.Root shows them. With
 * `showValue={false}` the button shows only a clock glyph.
 */
export function TimePicker({
  value,
  onValueChange,
  min,
  max,
  required,
  step = 30,
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
}: FieldTimePickerProps) {
  const strings = useStrings();
  const { clock } = useGlyphs();
  const textId = useDomId();
  // The button's name is not the time, so the time it shows is its description.
  const picker = useFieldPicker<'select'>({
    props: { ...props, 'aria-describedby': showValue ? mergeDescribedBy(describedBy, textId) : describedBy },
    label: strings.timePicker,
    open,
    defaultOpen,
    onOpenChange,
    style,
    required,
    // The list, which shows its active time.
    focusSelector: '[role="listbox"]',
    // A role-less popover around a named list of times.
    haspopup: 'listbox',
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
            {value ? formatTime(value, { locale }) : placeholder}
          </span>
        ) : null}
        <span className={styles.pickerGlyph} data-todae-glyph="" aria-hidden="true">
          {glyphOr(clock, <ClockGlyph />)}
        </span>
      </button>
      {/* A button sends nothing and the browser can't validate it, so the time goes in a value input. */}
      <input
        {...picker.getValueInputProps({
          type: 'time',
          value: value ? htmlTime(value) : '',
          required,
          min: min && htmlTime(min),
          max: max && htmlTime(max),
          // The list picks any time, so no step is off.
          step: 'any',
          bound: { min: min && formatTime(min, { locale }), max: max && formatTime(max, { locale }) },
        })}
      />
      {required ? <VisuallyHidden.Root id={picker.requiredId}>{strings.required}</VisuallyHidden.Root> : null}
      {/* Mounted while open only: a form can hold many time pickers. */}
      {picker.shown ? (
        <Popover.Root {...picker.popover.getPopoverProps()}>
          <TimeList
            value={value}
            step={step}
            min={min}
            max={max}
            locale={locale}
            label={strings.timePicker}
            onPick={(next) => {
              onValueChange?.(next);
              picker.setOpen(false, 'select');
            }}
          />
        </Popover.Root>
      ) : null}
    </>
  );
}
