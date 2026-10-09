import {
  useContext,
  useEffect,
  useId,
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
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Chip } from './Chip';
import {
  FIELD_CONTROL_SELECTOR,
  FOCUSABLE_FIELD_CONTROL_SELECTOR,
  FieldContext,
  inputLabel,
  mergeDescribedBy,
  useControlSetter,
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
import { useField } from '../hooks/useField';
import { useStrings, type Strings } from '../providers/StringsProvider';

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
  return { entry: null, counters: 0, listeners: new Set(), presence: new Set() };
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
      className={cx(styles.adornment, className)}
    />
  );
}

function Affix({ className, ...props }: FieldAffixProps) {
  return <span {...props} className={cx(styles.adornment, className)} />;
}

// Whether a select's picker is showing. A browser without `:open` throws,
// and treats the picker as closed.
function isOpen(select: HTMLSelectElement): boolean {
  try {
    return select.matches(':open');
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
  const autoId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLElement>(null);
  const pendingPicker = useRef<HTMLSelectElement | null>(null);
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
      store,
    }),
    [ariaLabel, describedBy, disabled, hintId, inputId, invalid, labelledBy, name, store],
  );

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    // Only a primary press: a right or middle click keeps its own meaning.
    if (event.button !== 0 || disabled || isInteractiveTarget(event.target)) return;
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
    // A press beside a select opens it, as a press on the select would. The
    // picker opens on click: one opened now would close again as the press
    // goes on. The press that closes an open picker must not open it again.
    pendingPicker.current = control instanceof HTMLSelectElement && !isOpen(control) ? control : null;
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const select = pendingPicker.current;
    pendingPicker.current = null;
    // Only the click that ends this press: one from the keyboard or from
    // assistive technology has no press (detail 0) and opens nothing.
    if (!select?.isConnected || event.detail === 0 || isInteractiveTarget(event.target)) return;
    try {
      select.showPicker?.();
    } catch {
      // Not allowed here, or not supported: focus is enough.
    }
  }

  return (
    <FieldContext.Provider value={ctx}>
      <div
        {...props}
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
 * Input types that take a string value. The number, date and time types keep
 * their native spinner and picker; `value` is the input's string, such as
 * `"2026-10-07"` or `"14:30"`.
 */
export type FieldTextInputType =
  | 'text'
  | 'search'
  | 'email'
  | 'url'
  | 'tel'
  | 'password'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime-local';

// Browsers ignore maxLength on these, so no limit is shown or announced.
const NO_LENGTH_LIMIT: ReadonlySet<FieldTextInputType> = new Set(['number', 'date', 'time', 'datetime-local']);

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
  ref,
  maxLength,
  'aria-describedby': describedBy,
  ...props
}: FieldTextInputProps) {
  const ctx = useFieldContext();
  const controlRef = useComposedRefs(useControlSetter(ctx.inputRef), ref);
  const limit = typeof maxLength === 'number' && !NO_LENGTH_LIMIT.has(type) ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  return (
    <input
      {...props}
      ref={controlRef}
      id={ctx.inputId}
      name={ctx.name}
      disabled={ctx.disabled}
      maxLength={maxLength}
      aria-invalid={ctx.invalid ? true : props['aria-invalid']}
      aria-describedby={mergeDescribedBy(ctx.describedBy, describedBy, counterMounted && limit !== undefined ? ctx.hintId : undefined)}
      {...inputLabel(props, ctx)}
      value={value}
      type={type}
      className={[styles.input, className].filter(Boolean).join(' ')}
      onChange={(event) => {
        onChange(event);
        onValueChange?.(event.target.value);
      }}
    />
  );
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
  ref,
  maxLength,
  'aria-describedby': describedBy,
  ...props
}: FieldTextareaProps) {
  const ctx = useFieldContext();
  const controlRef = useComposedRefs(useControlSetter(ctx.inputRef), ref);
  const resolved = useMemo(
    () => resolveTextareaRows({ rows: rowsProp, maxRows: maxRowsProp }),
    [rowsProp, maxRowsProp],
  );
  const limit = typeof maxLength === 'number' ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  return (
    <textarea
      {...props}
      ref={controlRef}
      id={ctx.inputId}
      name={ctx.name}
      disabled={ctx.disabled}
      maxLength={maxLength}
      aria-invalid={ctx.invalid ? true : props['aria-invalid']}
      aria-describedby={mergeDescribedBy(ctx.describedBy, describedBy, counterMounted && limit !== undefined ? ctx.hintId : undefined)}
      {...inputLabel(props, ctx)}
      value={value}
      rows={resolved.rows}
      data-auto-grow={autoGrow ? '' : undefined}
      data-max-rows={resolved.maxRows}
      className={[styles.textarea, className].filter(Boolean).join(' ')}
      style={
        {
          ...style,
          '--todae-field-rows': resolved.rows,
          '--todae-field-max-rows': resolved.maxRows,
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
  /** Chip remove button content, such as an icon from your own set. Without it, the CSS draws a cross. */
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
  'aria-describedby': describedBy,
  ref,
  setChips: _setChips,
  setInputValue: _setInputValue,
  reset: _reset,
  ...props
}: FieldChipInputProps & { setChips?: unknown; setInputValue?: unknown; reset?: unknown }) {
  const field = useFieldContext();
  // Its own input, for chip measuring and refocus; the Root's inputRef may
  // point at another control.
  const ownInput = useRef<HTMLInputElement | null>(null);
  const controlRef = useComposedRefs(useControlSetter(field.inputRef), ownInput, ref);
  const keys = useMemo(() => resolveCommitKeys(commitKeys), [commitKeys]);
  const keySet = useMemo(() => new Set<string>(keys), [keys]);
  const inRow = chipLayout === 'row';
  const list = useChipList({ chips, maxRows, reserveWidth: inRow ? undefined : ownInput });

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDownProp?.(event);
    if (event.defaultPrevented) return;
    if (field.disabled) return;
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
      disabled={field.disabled}
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
      {...props}
      ref={controlRef}
      id={field.inputId}
      name={field.name}
      disabled={field.disabled}
      aria-invalid={field.invalid ? true : props['aria-invalid']}
      aria-describedby={mergeDescribedBy(field.describedBy, describedBy)}
      {...inputLabel(props, field)}
      value={inputValue}
      type="text"
      className={[styles.input, className].filter(Boolean).join(' ')}
      onChange={(event) => onInputValueChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
  const measure =
    maxRows != null ? (
      <div ref={list.measureRef} className={styles.measure} aria-hidden inert>
        {chips.map((value, index) => (
          <Chip.Root key={`m:${index}:${value}`} onRemove={() => undefined} removeIcon={chipRemoveIcon} disabled={field.disabled}>
            {value}
          </Chip.Root>
        ))}
        <Chip.Root onRemove={() => undefined} removeIcon={chipRemoveIcon} disabled={field.disabled}>
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
            style={maxRows != null ? ({ '--todae-field-chip-rows': maxRows } as CSSProperties) : undefined}
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
      style={maxRows != null ? ({ '--todae-field-chip-rows': maxRows } as CSSProperties) : undefined}
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
  return (
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
  );
}

export type FieldCounterProps = {
  className?: string;
  style?: CSSProperties;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

let warnedOutsideRoot = false;
let warnedNoInput = false;

function liveCopy(remaining: number, strings: Strings) {
  return remaining <= 0 ? strings.characterLimitReached : strings.charactersLeft(remaining);
}

function CounterMissing() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || warnedOutsideRoot) return;
    warnedOutsideRoot = true;
    console.warn('Field.Counter must render inside Field.Root');
  }, []);
  return null;
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
  if (!ctx) return <CounterMissing />;
  return <CounterInner {...props} ctx={ctx} />;
}

export type FieldRowProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'div'>;

function Row({ className, ...props }: FieldRowProps) {
  return <div {...props} className={cx(styles.row, className)} />;
}

export const Field = { Root, TextInput, Textarea, ChipInput, Select, Icon, Affix, Counter, Row } as const;
