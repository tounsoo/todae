/// <reference lib="esnext.temporal" preserve="true" />
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useDomId } from './domId';
import {
  FIELD_CONTROL_SELECTOR,
  FOCUSABLE_FIELD_CONTROL_SELECTOR,
  FieldContext,
  mergeDescribedBy,
  type FieldContextValue,
} from './Field.context';
import { useFieldsetState } from './Fieldset.context';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Field.module.css';
import { useGlyphs } from '../providers/GlyphsProvider';
import { CalendarGlyph, glyphOr } from './glyphs';
import { useStrings, type Strings } from '../providers/StringsProvider';
import type { PopoverCloseReason } from '../hooks/usePopover';
import { Popover } from './Popover';
import {
  Calendar as CalendarParts,
  CALENDAR_TAB_STOP,
  GREGORY,
  isoDate,
  type CalendarFirstDayOfWeek,
} from './Calendar';
import { createCountStore, subscribeCount, pickerToggles, useFieldPicker, htmlDateTime } from './Field.shared';
import { TextInput } from './Field.TextInput';
import { Textarea } from './Field.Textarea';
import { ChipInput } from './Field.ChipInput';
import { Select } from './Field.Select';
import { ColorPicker } from './Field.ColorPicker';
import { DatePicker } from './Field.DatePicker';
import { timeSlots, TimeList, TimePicker } from './Field.TimePicker';

/**
 * `id`, `name` and the three naming ARIA props go to the input; every other
 * native attribute lands on the shell `div`.
 */
export type FieldRootProps = {
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'id'>;

export type FieldIconProps = {
  children?: ReactNode;
  interactive?: boolean;
  className?: string;
} & ComponentPropsWithRef<'span'>;

export type FieldAffixProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'span'>;

function Icon({ interactive, className, ...props }: FieldIconProps) {
  return (
    <span
      {...props}
      aria-hidden={props['aria-hidden'] ?? (interactive ? undefined : true)}
      className={cx(styles.adornment, styles.icon, className)}
    />
  );
}

function Affix({ className, ...props }: FieldAffixProps) {
  return <span {...props} className={cx(styles.adornment, className)} />;
}

type PickerControl = HTMLSelectElement | HTMLButtonElement;

// A control whose picker a press beside it opens: a select, Field.ColorPicker, Field.DatePicker, Field.TimePicker or Field.DateTimePicker.
function hasPicker(control: Element | null | undefined): control is PickerControl {
  return (
    control instanceof HTMLSelectElement ||
    (control instanceof HTMLButtonElement && control.hasAttribute('data-todae-field-picker'))
  );
}

// Whether a select's picker is showing. A browser without `:open` throws,
// and treats the picker as closed.
function isOpen(control: HTMLSelectElement): boolean {
  try {
    return control.matches(':open');
  } catch {
    return false;
  }
}

// Walks up by class list rather than a selector, so any hashed class name works.
function inAdornment(node: HTMLElement, shell: HTMLElement): boolean {
  for (let el = node.parentElement; el && el !== shell; el = el.parentElement) {
    if (styles.adornment && el.classList.contains(styles.adornment)) return true;
  }
  return false;
}

// A press in a part's own popover, such as Field.ColorPicker's, is not a press on the shell.
function inOwnPopover(target: EventTarget | null, shell: HTMLElement): boolean {
  const popover = target instanceof Element ? target.closest('[popover]') : null;
  return popover != null && shell.contains(popover);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      `button, a, [tabindex], [contenteditable]:not([contenteditable='false']), ${FIELD_CONTROL_SELECTOR}`,
    ),
  );
}

function Root({
  disabled: disabledProp,
  invalid: invalidProp,
  id,
  name,
  className,
  children,
  'aria-describedby': describedBy,
  'aria-labelledby': labelledBy,
  'aria-label': ariaLabel,
  onMouseDown: onMouseDownProp,
  onClick: onClickProp,
  ...props
}: FieldRootProps) {
  // Inside a Fieldset.Root, its disabled and invalid apply here too.
  const { disabled, invalid } = useFieldsetState({ disabled: disabledProp, invalid: invalidProp });
  const autoId = useDomId();
  const hintId = useDomId();
  const inputRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const shellComposed = useComposedRefs(shellRef, props.ref);
  const pendingPicker = useRef<PickerControl | null>(null);
  const [store] = useState(createCountStore);
  const inputId = id ?? autoId;

  // Stable while these inputs are, so parts and useField callbacks keep their identity.
  const ctx = useMemo(
    () => ({
      inputId,
      hintId,
      disabled: Boolean(disabled),
      invalid: Boolean(invalid),
      name,
      describedBy,
      labelledBy,
      ariaLabel,
      inputRef,
      shellRef,
      store,
    }),
    [ariaLabel, describedBy, disabled, hintId, inputId, invalid, labelledBy, name, store],
  );

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    // Only a primary press: a right or middle click keeps its own meaning.
    if (event.button !== 0 || disabled || isInteractiveTarget(event.target)) return;
    if (inOwnPopover(event.target, event.currentTarget)) return;
    event.preventDefault();
    // The ref is the last control to mount. If that one has gone, a control
    // still in the shell takes the press, never one inside an Icon or Affix.
    const current = inputRef.current;
    const usable = (node: HTMLElement) =>
      node.matches(FOCUSABLE_FIELD_CONTROL_SELECTOR) && !inAdornment(node, event.currentTarget);
    const control = current?.isConnected && usable(current)
      ? current
      : [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_FIELD_CONTROL_SELECTOR)].find(usable);
    control?.focus();
    // A press beside a select, color, date or time picker acts as a press on the control
    // would. The picker opens on click: one opened now would close again as
    // the press goes on. A select's open picker closes on this press, which
    // must not open it again; Field.ColorPicker's toggles on the click.
    pendingPicker.current =
      hasPicker(control) && (control instanceof HTMLButtonElement || !isOpen(control)) ? control : null;
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const picker = pendingPicker.current;
    pendingPicker.current = null;
    // Only the click that ends this press: one from the keyboard or from
    // assistive technology has no press (detail 0) and opens nothing.
    if (!picker?.isConnected || event.detail === 0 || isInteractiveTarget(event.target)) return;
    if (picker instanceof HTMLButtonElement) {
      pickerToggles.get(picker)?.();
      return;
    }
    try {
      picker.showPicker?.();
    } catch {
      // Not allowed here, or not supported: focus is enough.
    }
  }

  return (
    <FieldContext.Provider value={ctx}>
      <div
        {...props}
        ref={shellComposed}
        className={cx(styles.shell, className)}
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          // Each press decides afresh whether its click opens a picker, even
          // one whose consumer handler turns the shell's handling off.
          pendingPicker.current = null;
          composeHandlers(onMouseDownProp, onMouseDown)(event);
        }}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          composeHandlers(onClickProp, onClick)(event);
          // The press's click is over, whether the shell handled it or not.
          pendingPicker.current = null;
        }}
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export type { FieldTextInputType, FieldTextInputProps } from './Field.TextInput';
export type { FieldTextareaHighlight } from './TextareaHighlights';
export type { FieldTextareaProps } from './Field.Textarea';
export type { FieldChipInputProps } from './Field.ChipInput';
export type { FieldSelectProps } from './Field.Select';
export type { FieldColorPickerCloseReason, FieldColorPickerProps } from './Field.ColorPicker';
export type { FieldDatePickerCloseReason, FieldDatePickerProps } from './Field.DatePicker';
export type { FieldTimePickerCloseReason, FieldTimePickerProps } from './Field.TimePicker';

/** Why Field.DateTimePicker's popover closed: a popover's reasons, a pick that made the value, or the field became disabled. */
export type FieldDateTimePickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

export type FieldDateTimePickerProps = {
  /** The date and time, or null for none. */
  value: Temporal.PlainDateTime | null;
  /** Fires with the date and time when a pick leaves a date the calendar offers and a time in range for it. */
  onValueChange?: (value: Temporal.PlainDateTime) => void;
  /** The earliest date and time that can be picked. */
  min?: Temporal.PlainDateTime;
  /** The latest date and time that can be picked. */
  max?: Temporal.PlainDateTime;
  /** Returns true for a date that cannot be picked, such as a holiday. */
  isDateDisabled?: (date: Temporal.PlainDate) => boolean;
  /** The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** Minutes between the times in the list, from midnight. Defaults to 30. */
  step?: number;
  /** The locale for the button's text, the calendar's names and the times, such as "ko". The browser's own when not set, so pass it when the picker renders on a server. */
  locale?: string;
  /** Shown on the button while there is no date and time, when showValue is true. */
  placeholder?: string;
  /** Whether the button shows the date and time, or the placeholder, beside its glyph. Set it to false beside a text input that shows them. Defaults to true. */
  showValue?: boolean;
  /** Controlled open state of the popover. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the popover opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldDateTimePickerCloseReason) => void;
} & Omit<
  ComponentPropsWithRef<'button'>,
  'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'
>;

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
 * date it offers closes the popover. On its own it is the field's control and shows
 * the date and time, and a press elsewhere in the field opens the popover.
 * Beside any other control but a Field.ColorPicker, Field.DatePicker,
 * Field.TimePicker or Field.DateTimePicker, such as a Field.TextInput to type
 * the date and time in, that control is the field's control instead, and the
 * button is named from the dateTimePicker string. With `showValue={false}`
 * the button shows only a calendar glyph.
 */
function DateTimePicker({
  value,
  onValueChange,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
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
}: FieldDateTimePickerProps) {
  const strings = useStrings();
  const { calendar } = useGlyphs();
  const textId = useDomId();
  // The button's name is not the date and time, so what it shows is its description.
  const picker = useFieldPicker<'select'>({
    props: { ...props, 'aria-describedby': showValue ? mergeDescribedBy(describedBy, textId) : describedBy },
    label: strings.dateTimePicker,
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
            {value ? dateTimeLabel(value, locale) : placeholder}
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
          value={value ? htmlDateTime(value) : ''}
          disabled={picker.disabled}
          form={picker.form}
        />
      ) : null}
      {/* Mounted while open only: a form can hold many date and time pickers. */}
      {picker.shown ? (
        <Popover.Root
          {...picker.popover.getPopoverProps()}
          role="dialog"
          aria-label={strings.dateTimePicker}
          className={styles.datePickerPopover}
        >
          <DateTimePanel
            value={value}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            firstDayOfWeek={firstDayOfWeek}
            step={step}
            locale={locale}
            label={strings.timePicker}
            onValueChange={onValueChange}
            onDone={() => picker.setOpen(false, 'select')}
          />
        </Popover.Root>
      ) : null}
    </>
  );
}

export type FieldCounterProps = {
  className?: string;
  style?: CSSProperties;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

let warnedNoInput = false;

function liveCopy(remaining: number, strings: Strings) {
  return remaining <= 0 ? strings.characterLimitReached : strings.charactersLeft(remaining);
}

function CounterInner({ ctx, className, ...props }: FieldCounterProps & { ctx: FieldContextValue }) {
  const strings = useStrings();
  const entry = useSyncExternalStore(
    (listener) => subscribeCount(ctx.store, listener),
    () => ctx.store.entry,
    () => ctx.store.entry,
  );
  useEffect(() => {
    ctx.store.counters += 1;
    for (const listener of ctx.store.presence) listener();
    return () => {
      ctx.store.counters -= 1;
      for (const listener of ctx.store.presence) listener();
    };
  }, [ctx.store]);
  useEffect(() => {
    if (ctx.store.entry || process.env.NODE_ENV === 'production' || warnedNoInput) return;
    warnedNoInput = true;
    console.warn('Field.Counter has no Field.TextInput or Field.Textarea');
  });
  if (!entry) return null;
  const count = entry.value.length;
  const max = entry.maxLength;
  const atLimit = max !== undefined && count === max;
  const over = max !== undefined && count > max;
  const remaining = max === undefined ? undefined : max - count;
  return (
    <span
      {...props}
      data-todae-counter=""
      data-limit={atLimit ? '' : undefined}
      data-over={over ? '' : undefined}
      data-invalid={ctx.invalid ? '' : undefined}
      data-disabled={ctx.disabled ? '' : undefined}
      className={cx(styles.counter, className)}
    >
      <span aria-hidden="true">{max === undefined ? String(count) : `${count} / ${max}`}</span>
      {max === undefined ? null : (
        <>
          <span id={ctx.hintId} className={styles.srOnly}>
            {strings.characterLimit(max)}
          </span>
          <span className={styles.srOnly} aria-live="polite">
            {remaining !== undefined && remaining <= 20 ? liveCopy(remaining, strings) : ''}
          </span>
        </>
      )}
    </span>
  );
}

function Counter(props: FieldCounterProps) {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field.Counter must render inside Field.Root');
  return <CounterInner {...props} ctx={ctx} />;
}

export type FieldRowProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'div'>;

function Row({ className, ...props }: FieldRowProps) {
  return <div {...props} className={cx(styles.row, className)} />;
}

export type FieldGroupProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'div'>;

/** Puts a label or caption field.label.gap above the control; Description and ErrorMessage keep the distances they have outside a group. */
function Group({ className, ...props }: FieldGroupProps) {
  return <div {...props} className={cx(styles.group, className)} />;
}

export const Field = {
  Root,
  TextInput,
  Textarea,
  ChipInput,
  Select,
  ColorPicker,
  DatePicker,
  TimePicker,
  DateTimePicker,
  Icon,
  Affix,
  Counter,
  Row,
  Group,
} as const;
