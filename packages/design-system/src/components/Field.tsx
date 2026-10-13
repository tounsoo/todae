import {
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
import { useField } from '../hooks/useField';
import { useControlledValue } from '../hooks/useControlledState';
import { useGlyphs } from '../providers/GlyphsProvider';
import { hasGlyph } from './glyphs';
import { useStrings, type Strings } from '../providers/StringsProvider';
import { usePopover, type PopoverCloseReason, type PopoverTriggerUserProps } from '../hooks/usePopover';
import { Popover } from './Popover';
import { ColorPicker as ColorPickerParts } from './ColorPicker';

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
      className={cx(styles.adornment, styles.icon, className)}
    />
  );
}

function Affix({ className, ...props }: FieldAffixProps) {
  return <span {...props} className={cx(styles.adornment, className)} />;
}

type PickerControl = HTMLSelectElement | HTMLButtonElement;

// A control whose picker a press beside it opens: a select or Field.ColorPicker.
function hasPicker(control: Element | null | undefined): control is PickerControl {
  return (
    control instanceof HTMLSelectElement ||
    (control instanceof HTMLButtonElement && control.hasAttribute('data-todae-field-picker'))
  );
}

// How the shell opens or closes each Field.ColorPicker's popover, by its button.
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
    // A press beside a select or color picker acts as a press on the control
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
 * elsewhere in the field. Put the value beside it as text with Field.Affix.
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
  const field = useField();
  const { shellRef } = useFieldContext();
  const strings = useStrings();
  const { name, ...control } = field.getControlProps(props);
  const [open, setOpen] = useControlledValue<boolean, [FieldColorPickerCloseReason]>(
    openProp,
    defaultOpen ?? false,
    onOpenChange,
  );
  // A disabled field shows no picker. One open when the field is disabled
  // closes, so it does not come back when the field is enabled again.
  const shown = open && !control.disabled;
  useEffect(() => {
    if (open && control.disabled) setOpen(false, 'disabled');
  }, [control.disabled, open, setOpen]);
  const popover = usePopover({
    open: shown,
    onOpenChange: setOpen,
    // Anchored to the shell, so a press anywhere in the field is not outside.
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
      {name ? <input type="hidden" name={name} value={value} disabled={control.disabled} /> : null}
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

export const Field = { Root, TextInput, Textarea, ChipInput, Select, ColorPicker, Icon, Affix, Counter, Row, Group } as const;
