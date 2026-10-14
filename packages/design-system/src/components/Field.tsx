/// <reference lib="esnext.temporal" preserve="true" />
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useDomId } from './domId';
import { Chip } from './Chip';
import {
  FIELD_CONTROL_SELECTOR,
  FOCUSABLE_FIELD_CONTROL_SELECTOR,
  FieldContext,
  mergeDescribedBy,
  useFieldContext,
  type CountStore,
  type FieldContextValue,
} from './Field.context';
import { useFieldsetState } from './Fieldset.context';
import { composeHandlers, cx, useComposedRefs } from './props';
import { resolveCommitKeys, type ChipCommitKey } from './commitKeys';
import styles from './Field.module.css';
import { resolveTextareaRows } from './textareaRows';
import { useChipList } from '../hooks/useChipList';
import { useField, useFieldControl, type FieldControlUserProps, type UseFieldResult } from '../hooks/useField';
import { useControlledValue } from '../hooks/useControlledState';
import { useGlyphs } from '../providers/GlyphsProvider';
import { CalendarGlyph, glyphOr, hasGlyph } from './glyphs';
import { useStrings, type Strings } from '../providers/StringsProvider';
import { usePopover, type PopoverCloseReason, type PopoverTriggerUserProps } from '../hooks/usePopover';
import { Popover } from './Popover';
import { ColorPicker as ColorPickerParts } from './ColorPicker';
import {
  Calendar as CalendarParts,
  CALENDAR_TAB_STOP,
  GREGORY,
  isoDate,
  type CalendarFirstDayOfWeek,
} from './Calendar';

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

function createCountStore(): CountStore {
  return { entry: null, counters: 0, controls: 0, named: 0, dates: 0, listeners: new Set(), presence: new Set() };
}

function publishCount(store: CountStore, value: string, maxLength: number | undefined) {
  const prev = store.entry;
  if (prev && prev.value === value && prev.maxLength === maxLength) return;
  store.entry = { value, maxLength };
}

function subscribeCount(store: CountStore, listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function subscribePresence(store: CountStore, listener: () => void) {
  store.presence.add(listener);
  return () => {
    store.presence.delete(listener);
  };
}

function counterMounted(store: CountStore) {
  return store.counters > 0;
}

type PickerOwnProps = {
  name?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: FieldControlUserProps['aria-invalid'];
};

const BESIDE_CONTROL = 1;
const BESIDE_NAMED = 2;
const BESIDE_DATE = 4;

/**
 * Which controls a picker shares its field with, as bits: BESIDE_CONTROL for
 * any control wired with useField, BESIDE_NAMED when useField gave one the
 * field's name, BESIDE_DATE when one is a date input. The server cannot know of one yet, so it reads 0
 * until hydration.
 */
function usePickerPresence(store: CountStore) {
  const subscribe = useCallback((listener: () => void) => subscribePresence(store, listener), [store]);
  return useSyncExternalStore(
    subscribe,
    () => (store.controls > 0 ? BESIDE_CONTROL : 0) |
      (store.named > 0 ? BESIDE_NAMED : 0) |
      (store.dates > 0 ? BESIDE_DATE : 0),
    () => 0,
  );
}

/**
 * A picker's control props. Alone, it is the field's control. Beside another
 * control, that control takes the field's id and description, and the field's
 * name too when useField gave it that name. The picker keeps its own
 * `name`, else the field's name when no other control has it, and `disabled`
 * and `aria-invalid`, and is named `label`.
 */
function pickerControl<P extends PickerOwnProps>(
  presence: number,
  field: UseFieldResult,
  props: P,
  label: string,
) {
  if (!(presence & BESIDE_CONTROL)) return field.getControlProps(props);
  return {
    ...props,
    name: props.name ?? (presence & BESIDE_NAMED ? undefined : field.name),
    disabled: field.disabled || Boolean(props.disabled),
    'aria-invalid': field.invalid ? true : props['aria-invalid'],
    'aria-label': props['aria-label'] ?? label,
  };
}

function useTextEntry(store: CountStore, value: string, maxLength: number | undefined) {
  publishCount(store, value, maxLength);
  useEffect(() => {
    for (const listener of store.listeners) listener();
  });
  return useSyncExternalStore(
    (listener) => subscribePresence(store, listener),
    () => counterMounted(store),
    () => counterMounted(store),
  );
}

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

// A control whose picker a press beside it opens: a select, Field.ColorPicker or Field.DatePicker.
function hasPicker(control: Element | null | undefined): control is PickerControl {
  return (
    control instanceof HTMLSelectElement ||
    (control instanceof HTMLButtonElement && control.hasAttribute('data-todae-field-picker'))
  );
}

// How the shell opens or closes each Field.ColorPicker's or Field.DatePicker's popover, by its button.
const pickerToggles = new WeakMap<HTMLButtonElement, () => void>();

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
    // A press beside a select, color picker or date picker acts as a press on the control
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

/**
 * Input types that take a string value. The number type keeps its native
 * spinner; `value` is the input's string, such as `"42"`. Dates and times are
 * `Field.DateInput`, `Field.TimeInput` and `Field.DateTimeInput`.
 */
export type FieldTextInputType = 'text' | 'search' | 'email' | 'url' | 'tel' | 'password' | 'number';

// Browsers ignore maxLength on these, so no limit is shown or announced.
const NO_LENGTH_LIMIT: ReadonlySet<FieldTextInputType> = new Set(['number']);

export type FieldTextInputProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  type?: FieldTextInputType;
  ref?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type' | 'disabled' | 'onChange'>;

function TextInput({
  value,
  onChange,
  onValueChange,
  type = 'text',
  className,
  maxLength,
  'aria-describedby': describedBy,
  ...props
}: FieldTextInputProps) {
  const field = useField();
  const ctx = useFieldContext();
  const limit = typeof maxLength === 'number' && !NO_LENGTH_LIMIT.has(type) ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  const hint = counterMounted && limit !== undefined ? ctx.hintId : undefined;
  return (
    <input
      {...field.getControlProps({ ...props, 'aria-describedby': mergeDescribedBy(describedBy, hint) })}
      maxLength={maxLength}
      value={value}
      type={type}
      className={cx(styles.input, className)}
      onChange={(event) => {
        onChange(event);
        onValueChange?.(event.target.value);
      }}
    />
  );
}

type TemporalInputProps<T> = {
  /** The value, or `null` while the input is empty or incomplete. */
  value: T | null;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: T | null) => void;
  min?: T;
  max?: T;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'type' | 'disabled' | 'onChange' | 'min' | 'max' | 'maxLength' | 'minLength'
>;

export type FieldDateInputProps = TemporalInputProps<Temporal.PlainDate>;
export type FieldTimeInputProps = TemporalInputProps<Temporal.PlainTime>;
export type FieldDateTimeInputProps = TemporalInputProps<Temporal.PlainDateTime>;

type TemporalInputKind<T> = {
  type: 'date' | 'time' | 'datetime-local';
  format: (value: T) => string;
  parse: (text: string) => T;
};

// A string for the input stops at the smallest unit that is set. The browser may
// report more, such as 01:30:00 when step is under a minute; see sameText.
function timeUnit(value: Temporal.PlainTime | Temporal.PlainDateTime) {
  if (value.millisecond || value.microsecond || value.nanosecond) return 'millisecond';
  return value.second ? 'second' : 'minute';
}

// HTML writes a year past 9999 as plain digits (20261-10-07); Temporal writes it
// with a sign and six digits (+020261-10-07).
function fromHtmlYear(text: string) {
  return text.replace(/^(\d{5,6})(?=-)/, (year) => `+${year.padStart(6, '0')}`);
}

function toHtmlYear(text: string) {
  return text.replace(/^\+0*(\d{4,})(?=-)/, '$1');
}

const DATE: TemporalInputKind<Temporal.PlainDate> = {
  type: 'date',
  format: (value) => toHtmlYear(value.toString({ calendarName: 'never' })),
  parse: (text) => Temporal.PlainDate.from(fromHtmlYear(text)),
};

const TIME: TemporalInputKind<Temporal.PlainTime> = {
  type: 'time',
  format: (value) => value.toString({ smallestUnit: timeUnit(value) }),
  parse: (text) => Temporal.PlainTime.from(text),
};

const DATE_TIME: TemporalInputKind<Temporal.PlainDateTime> = {
  type: 'datetime-local',
  format: (value) => toHtmlYear(value.toString({ smallestUnit: timeUnit(value), calendarName: 'never' })),
  parse: (text) => Temporal.PlainDateTime.from(fromHtmlYear(text)),
};

// Drops zero seconds and trailing zeros of a fraction, so 01:30:00.000 and 01:30 match.
function canonicalTime(text: string) {
  return text.replace(/(\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?$/, (_match, minutes: string, seconds = '00', digits = '') => {
    const fraction = (digits as string).replace(/0+$/, '');
    if (fraction) return `${minutes}:${seconds}.${fraction}`;
    return seconds === '00' ? minutes : `${minutes}:${seconds}`;
  });
}

// Whether the browser's own string already shows the value. Writing a different
// string for the same value would reset what the user is typing.
function sameText(typed: string, formatted: string) {
  return canonicalTime(typed) === canonicalTime(formatted);
}

/** The value, `null` for an empty or incomplete input, or `undefined` for a string Temporal can't read. */
function readTemporal<T>(kind: TemporalInputKind<T>, text: string): T | null | undefined {
  if (text === '') return null;
  try {
    return kind.parse(text);
  } catch (error) {
    // A date the browser accepts past Temporal's range, which ends in the year 275760.
    // Anything else, such as no Temporal at all, is the app's to fix, so it throws.
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

function TemporalInput<T>({
  kind,
  value,
  onChange,
  onValueChange,
  min,
  max,
  className,
  ...props
}: TemporalInputProps<T> & { kind: TemporalInputKind<T> }) {
  const field = useField();
  // The string the browser last reported, kept while it still shows `value`.
  const [typed, setTyped] = useState<string | null>(null);
  const formatted = value === null ? '' : kind.format(value);
  const text = typed !== null && value !== null && sameText(typed, formatted) ? typed : formatted;
  return (
    <input
      {...field.getControlProps(props)}
      type={kind.type}
      value={text}
      min={min === undefined ? undefined : kind.format(min)}
      max={max === undefined ? undefined : kind.format(max)}
      className={cx(styles.input, className)}
      // Without either handler the input is read-only, and React says so.
      onChange={
        onChange || onValueChange
          ? (event) => {
              const next = onValueChange ? readTemporal(kind, event.target.value) : undefined;
              setTyped(event.target.value);
              onChange?.(event);
              if (next !== undefined) onValueChange?.(next);
            }
          : undefined
      }
    />
  );
}

/** A native date input whose value is a `Temporal.PlainDate`. */
function DateInput(props: FieldDateInputProps) {
  return <TemporalInput {...props} kind={DATE} />;
}

/** A native time input whose value is a `Temporal.PlainTime`. */
function TimeInput(props: FieldTimeInputProps) {
  return <TemporalInput {...props} kind={TIME} />;
}

/** A native `datetime-local` input whose value is a `Temporal.PlainDateTime`. */
function DateTimeInput(props: FieldDateTimeInputProps) {
  return <TemporalInput {...props} kind={DATE_TIME} />;
}

export type FieldTextareaProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxRows?: number;
  autoGrow?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'disabled' | 'onChange' | 'rows' | 'cols'>;

function Textarea({
  value,
  onChange,
  onValueChange,
  rows: rowsProp,
  maxRows: maxRowsProp,
  autoGrow = false,
  className,
  style,
  maxLength,
  'aria-describedby': describedBy,
  ...props
}: FieldTextareaProps) {
  const field = useField();
  const ctx = useFieldContext();
  const resolved = useMemo(
    () => resolveTextareaRows({ rows: rowsProp, maxRows: maxRowsProp }),
    [rowsProp, maxRowsProp],
  );
  const limit = typeof maxLength === 'number' ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  const hint = counterMounted && limit !== undefined ? ctx.hintId : undefined;
  return (
    <textarea
      {...field.getControlProps({ ...props, 'aria-describedby': mergeDescribedBy(describedBy, hint) })}
      maxLength={maxLength}
      value={value}
      rows={resolved.rows}
      data-auto-grow={autoGrow ? '' : undefined}
      data-max-rows={resolved.maxRows}
      className={cx(styles.textarea, className)}
      style={
        {
          ...style,
          '--_text-rows': resolved.rows,
          '--_max-rows': resolved.maxRows,
        } as CSSProperties
      }
      onChange={(event) => {
        onChange(event);
        onValueChange?.(event.target.value);
      }}
    />
  );
}

export type FieldChipInputProps = {
  chips: readonly string[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onCommit: (value: string) => void;
  onChipRemove: (index: number, value: string) => void;
  commitKeys?: readonly ChipCommitKey[];
  maxRows?: number;
  chipLayout?: 'inline' | 'row';
  removeOnBackspace?: boolean;
  chipRemoveLabel?: (value: string) => string;
  /** Chip remove button content, such as an icon from your own set. Without it, the close glyph from GlyphsProvider, else Todae's cross. */
  chipRemoveIcon?: ReactNode;
  overflowLabel?: (n: number) => string;
  ref?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'disabled' | 'type' | 'children'>;

function ChipInput({
  chips,
  inputValue,
  onInputValueChange,
  onCommit,
  onChipRemove,
  commitKeys,
  maxRows,
  chipLayout = 'inline',
  removeOnBackspace = true,
  chipRemoveLabel,
  chipRemoveIcon,
  overflowLabel,
  className,
  onKeyDown: onKeyDownProp,
  ref,
  ...props
}: FieldChipInputProps) {
  const field = useField();
  // Its own input, for chip measuring and refocus; the Root's inputRef may
  // point at another control.
  const ownInput = useRef<HTMLInputElement | null>(null);
  const controlRef = useComposedRefs(ownInput, ref);
  const keys = useMemo(() => resolveCommitKeys(commitKeys), [commitKeys]);
  const keySet = useMemo(() => new Set<string>(keys), [keys]);
  const inRow = chipLayout === 'row';
  const list = useChipList({ chips, maxRows, reserveWidth: inRow ? undefined : ownInput });
  const control = field.getControlProps({ ...props, ref: controlRef });
  // The Root's disabled or the input's own: the chips follow the input.
  const disabled = Boolean(control.disabled);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDownProp?.(event);
    if (event.defaultPrevented) return;
    if (disabled) return;
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    if (event.key === 'Backspace' && inputValue === '' && chips.length > 0 && removeOnBackspace) {
      const index = chips.length - 1;
      const value = chips[index];
      if (value === undefined) return;
      event.preventDefault();
      onChipRemove(index, value);
      return;
    }
    if (!keySet.has(event.key)) return;
    const trimmed = inputValue.trim();
    if (trimmed === '') return;
    event.preventDefault();
    onCommit(trimmed);
  }

  const chipNodes = list.visible.map((chip, index) => (
    <Chip.Root
      key={chip.key}
      disabled={disabled}
      removeLabel={chipRemoveLabel?.(chip.value)}
      removeIcon={chipRemoveIcon}
      data-ellipsis={chip.ellipsis ? '' : undefined}
      style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}
      onRemove={() => {
        onChipRemove(index, chip.value);
        ownInput.current?.focus();
      }}
    >
      {chip.value}
    </Chip.Root>
  ));
  const overflow = list.hidden > 0 ? <Chip.Overflow overflowCount={list.hidden} overflowLabel={overflowLabel} /> : null;
  const input = (
    <input
      {...control}
      value={inputValue}
      type="text"
      className={cx(styles.input, className)}
      onChange={(event) => onInputValueChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
  const measure =
    maxRows != null ? (
      <div ref={list.measureRef} className={styles.measure} aria-hidden inert>
        {chips.map((value, index) => (
          <Chip.Root key={`m:${index}:${value}`} onRemove={() => undefined} removeIcon={chipRemoveIcon} disabled={disabled}>
            {value}
          </Chip.Root>
        ))}
        <Chip.Root onRemove={() => undefined} removeIcon={chipRemoveIcon} disabled={disabled}>
          …
        </Chip.Root>
        <Chip.Overflow overflowCount={chips.length || 1} overflowLabel={overflowLabel} />
      </div>
    ) : null;

  if (inRow) {
    return (
      <div className={styles.flow} ref={list.listRef} data-chip-layout="row">
        {chips.length > 0 ? (
          <div
            className={styles.row}
            data-max-rows={maxRows ?? undefined}
            data-measured={maxRows != null && list.measured ? '' : undefined}
            style={maxRows != null ? ({ '--_chip-rows': maxRows } as CSSProperties) : undefined}
          >
            {chipNodes}
            {overflow}
          </div>
        ) : null}
        {input}
        {measure}
      </div>
    );
  }

  return (
    <div
      className={styles.flow}
      ref={list.listRef}
      data-max-rows={maxRows ?? undefined}
      data-measured={maxRows != null && list.measured ? '' : undefined}
      style={maxRows != null ? ({ '--_chip-rows': maxRows } as CSSProperties) : undefined}
    >
      {chipNodes}
      {overflow}
      {input}
      {measure}
    </div>
  );
}

/**
 * A native `<select>`. Browsers with `appearance: base-select` draw the picker
 * from tokens; others keep their native picker. Children are `<option>` and
 * `<optgroup>` elements. `id` and `name` go on `Field.Root`.
 */
export type FieldSelectProps = {
  value: string;
  /** Optional: `onValueChange` alone is enough when the event is not needed. */
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
  ref?: Ref<HTMLSelectElement>;
} & Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue' | 'disabled' | 'onChange' | 'multiple' | 'size' | 'children' | 'id' | 'name'
>;

function Select({ value, onChange, onValueChange, className, children, ...props }: FieldSelectProps) {
  const field = useField();
  const { chevron } = useGlyphs();
  return (
    <>
      <select
        {...field.getControlProps(props)}
        value={value}
        className={cx(styles.select, className)}
        // Without either handler the select is read-only, and React says so.
        onChange={
          onChange || onValueChange
            ? (event) => {
                onChange?.(event);
                onValueChange?.(event.target.value);
              }
            : undefined
        }
      >
        {children}
      </select>
      {/* Drawn over the browser's picker icon, which keeps its place. */}
      {hasGlyph(chevron) ? (
        <span className={styles.selectGlyph} data-todae-glyph="" aria-hidden="true">
          {chevron}
        </span>
      ) : null}
    </>
  );
}

/** Why Field.ColorPicker's picker closed: a popover's reasons, or the field became disabled. */
export type FieldColorPickerCloseReason = PopoverCloseReason | 'disabled';

export type FieldColorPickerProps = {
  /** The color as #rrggbb. */
  value: string;
  /** Fires with the new color as #rrggbb while it is dragged or keyed in the picker. */
  onValueChange?: (value: string) => void;
  /** Controlled open state of the picker. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the picker opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldColorPickerCloseReason) => void;
} & Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'children' | 'type' | 'color' | 'onChange'>;

/**
 * The field's control: a button the height of a line of field text, filled
 * with the color. It opens a ColorPicker in a popover, as does a press
 * elsewhere in the field. Beside any other control in the field but a
 * Field.ColorPicker or Field.DatePicker, such as a Field.TextInput, that
 * control is the field's control instead, and the button is named from the colorPicker string.
 */
function ColorPicker({
  value,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  style,
  ...props
}: FieldColorPickerProps) {
  // The swatch does not count itself as a control another picker should leave the field to.
  const field = useFieldControl(false);
  const { shellRef, store } = useFieldContext();
  const strings = useStrings();
  // Another control in the field takes its id and description, and one that
  // useField gave the field's name, that name.
  const presence = usePickerPresence(store);
  const { name, ...control } = pickerControl(presence, field, props, strings.colorPicker);
  const [open, setOpen] = useControlledValue<boolean, [FieldColorPickerCloseReason]>(
    openProp,
    defaultOpen ?? false,
    onOpenChange,
  );
  // A disabled field shows no picker. One open when the field is disabled
  // closes, so it does not come back when the field is enabled again.
  const shown = open && !control.disabled;
  // The latest setter, so a new onOpenChange each render does not fire it again.
  const close = useRef(setOpen);
  close.current = setOpen;
  useEffect(() => {
    if (open && control.disabled) close.current(false, 'disabled');
  }, [control.disabled, open]);
  const popover = usePopover({
    open: shown,
    onOpenChange: setOpen,
    // For the outside-press check: a press anywhere in the field is not outside.
    anchorRef: shellRef,
    enabled: !control.disabled,
  });
  const trigger = popover.getTriggerProps({ ...control, style } as PopoverTriggerUserProps);
  const toggle = useRef(() => {});
  toggle.current = () => {
    if (!control.disabled) setOpen(!shown, 'trigger');
  };
  useLayoutEffect(() => {
    const button = popover.triggerRef.current;
    if (!(button instanceof HTMLButtonElement)) return;
    pickerToggles.set(button, () => toggle.current());
    return () => {
      pickerToggles.delete(button);
    };
  }, [popover.triggerRef]);
  // The popover exists only while open, so only then does the button control it.
  const controls = shown ? trigger['aria-controls'] : undefined;
  return (
    <>
      <button
        {...(trigger as ComponentPropsWithRef<'button'>)}
        aria-controls={controls}
        type="button"
        data-todae-field-picker=""
        className={cx(styles.swatch, className)}
        style={{ ...trigger.style, '--_swatch': value } as CSSProperties}
      />
      {/* A button sends nothing with a form, so the value goes in a hidden input. */}
      {name ? <input type="hidden" name={name} value={value} disabled={control.disabled} form={control.form} /> : null}
      {/* Mounted while open only: a form can hold many swatches. */}
      {shown ? (
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label={strings.colorPicker}>
          <ColorPickerParts.Root value={value} onValueChange={onValueChange}>
            <ColorPickerParts.Area />
            <ColorPickerParts.Hue />
          </ColorPickerParts.Root>
        </Popover.Root>
      ) : null}
    </>
  );
}

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
  /** Shown on the button while there is no date, when no date input is beside it. */
  placeholder?: string;
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
 * calendar. Beside any other control but a Field.ColorPicker or
 * Field.DatePicker, such as a Field.DateInput, that control is the field's
 * control instead, and the button is named from the datePicker
 * string. Beside a date input, the button shows only a calendar glyph.
 */
function DatePicker({
  value,
  onValueChange,
  min,
  max,
  isDateDisabled,
  firstDayOfWeek,
  locale,
  placeholder,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  style,
  'aria-describedby': describedBy,
  ...props
}: FieldDatePickerProps) {
  // The button does not count itself as a control another picker should leave the field to.
  const field = useFieldControl(false);
  const { shellRef, store } = useFieldContext();
  const strings = useStrings();
  const { calendar } = useGlyphs();
  const textId = useDomId();
  // Another control in the field takes its id and description; beside a date
  // input, which holds the date too, the button shows only the glyph.
  const presence = usePickerPresence(store);
  const showText = !(presence & BESIDE_DATE);
  // The button's name is not the date, so the date it shows is its description.
  const ownDescribedBy = showText ? mergeDescribedBy(describedBy, textId) : describedBy;
  const { name, ...control } = pickerControl(
    presence,
    field,
    { ...props, 'aria-describedby': ownDescribedBy },
    strings.datePicker,
  );
  const [open, setOpen] = useControlledValue<boolean, [FieldDatePickerCloseReason]>(
    openProp,
    defaultOpen ?? false,
    onOpenChange,
  );
  // A disabled field shows no calendar, and one open when the field is
  // disabled closes, so it does not come back when the field is enabled again.
  const shown = open && !control.disabled;
  const close = useRef(setOpen);
  close.current = setOpen;
  useEffect(() => {
    if (open && control.disabled) close.current(false, 'disabled');
  }, [control.disabled, open]);
  // Focus goes to the calendar's Tab stop: the date, or else today or the
  // nearest date in range.
  const popoverRef = useRef<RefObject<HTMLElement | null> | null>(null);
  const initialFocusRef = useMemo(
    () => ({
      get current() {
        const panel = popoverRef.current?.current;
        return panel?.querySelector<HTMLElement>(CALENDAR_TAB_STOP) ?? null;
      },
    }),
    [],
  );
  const popover = usePopover({
    open: shown,
    onOpenChange: setOpen,
    // For the outside-press check: a press anywhere in the field is not outside.
    anchorRef: shellRef,
    initialFocusRef,
    enabled: !control.disabled,
  });
  popoverRef.current = popover.popoverRef;
  const trigger = popover.getTriggerProps({ ...control, style } as PopoverTriggerUserProps);
  const toggle = useRef(() => {});
  toggle.current = () => {
    if (!control.disabled) setOpen(!shown, 'trigger');
  };
  useLayoutEffect(() => {
    const button = popover.triggerRef.current;
    if (!(button instanceof HTMLButtonElement)) return;
    pickerToggles.set(button, () => toggle.current());
    return () => {
      pickerToggles.delete(button);
    };
  }, [popover.triggerRef]);
  const controls = shown ? trigger['aria-controls'] : undefined;
  const glyph = (
    <span className={styles.dateGlyph} data-todae-glyph="" aria-hidden="true">
      {glyphOr(calendar, <CalendarGlyph />)}
    </span>
  );
  return (
    <>
      <button
        {...(trigger as ComponentPropsWithRef<'button'>)}
        aria-controls={controls}
        type="button"
        data-todae-field-picker=""
        data-beside={showText ? undefined : ''}
        className={cx(styles.datePicker, className)}
      >
        {showText ? (
          <span id={textId} className={styles.dateText} data-placeholder={value ? undefined : ''}>
            {value ? isoDate(value).toLocaleString(locale, { dateStyle: 'medium', calendar: GREGORY }) : placeholder}
          </span>
        ) : null}
        {glyph}
      </button>
      {/* A button sends nothing with a form, so the value goes in a hidden input. */}
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ? DATE.format(isoDate(value)) : ''}
          disabled={control.disabled}
          form={control.form}
        />
      ) : null}
      {/* Mounted while open only: a form can hold many date pickers. */}
      {shown ? (
        <Popover.Root
          {...popover.getPopoverProps()}
          role="dialog"
          aria-label={strings.datePicker}
          className={styles.datePickerPopover}
        >
          <CalendarParts.Root
            value={value}
            onValueChange={(next) => {
              onValueChange?.(next);
              setOpen(false, 'select');
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
  DateInput,
  TimeInput,
  DateTimeInput,
  Icon,
  Affix,
  Counter,
  Row,
  Group,
} as const;
