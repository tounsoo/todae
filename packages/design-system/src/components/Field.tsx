import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type TextareaHTMLAttributes,
} from 'react';
import { Chip } from './Chip';
import { resolveCommitKeys, type ChipCommitKey } from './commitKeys';
import styles from './Field.module.css';
import { resolveTextareaRows } from './textareaRows';
import { useChipMeasure } from './useChipMeasure';

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
};

type CountEntry = { value: string; maxLength?: number };

type CountStore = {
  entry: CountEntry | null;
  counters: number;
  listeners: Set<() => void>;
  presence: Set<() => void>;
};

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

function mergeDescribedBy(root?: string, own?: string, hint?: string) {
  const ids = [root, own, hint].filter((id): id is string => Boolean(id));
  return ids.length > 0 ? ids.join(' ') : undefined;
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

type FieldContextValue = {
  inputId: string;
  hintId: string;
  disabled: boolean;
  invalid: boolean;
  name?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  store: CountStore;
};

const FieldContext = createContext<FieldContextValue | null>(null);

function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must be rendered inside Field.Root');
  return ctx;
}

export type FieldIconProps = {
  children?: ReactNode;
  interactive?: boolean;
  className?: string;
};

export type FieldAffixProps = {
  children?: ReactNode;
  className?: string;
};

function Icon({ children, interactive, className }: FieldIconProps) {
  return (
    <span
      className={[styles.adornment, className].filter(Boolean).join(' ')}
      aria-hidden={interactive ? undefined : true}
    >
      {children}
    </span>
  );
}

function Affix({ children, className }: FieldAffixProps) {
  return <span className={[styles.adornment, className].filter(Boolean).join(' ')}>{children}</span>;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [tabindex]'));
}

function Root({ disabled, invalid, id, name, className, style, ref, children, ...aria }: FieldRootProps) {
  const autoId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [store] = useState(createCountStore);
  const inputId = id ?? autoId;

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (disabled || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    inputRef.current?.focus();
  }

  return (
    <FieldContext.Provider
      value={{
        inputId,
        hintId,
        disabled: Boolean(disabled),
        invalid: Boolean(invalid),
        name,
        describedBy: aria['aria-describedby'],
        labelledBy: aria['aria-labelledby'],
        ariaLabel: aria['aria-label'],
        inputRef,
        store,
      }}
    >
      <div
        ref={ref}
        className={[styles.shell, className].filter(Boolean).join(' ')}
        style={style}
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        onMouseDown={onMouseDown}
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export type FieldTextInputType = 'text' | 'search' | 'email' | 'url' | 'tel' | 'password';

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
  const ctx = useField();
  const limit = typeof maxLength === 'number' ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  return (
    <input
      {...props}
      ref={(node) => {
        ctx.inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      id={ctx.inputId}
      name={ctx.name}
      disabled={ctx.disabled}
      maxLength={maxLength}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={mergeDescribedBy(ctx.describedBy, describedBy, counterMounted && limit !== undefined ? ctx.hintId : undefined)}
      aria-labelledby={ctx.labelledBy}
      aria-label={ctx.ariaLabel}
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
  const ctx = useField();
  const resolved = useMemo(
    () => resolveTextareaRows({ rows: rowsProp, maxRows: maxRowsProp }),
    [rowsProp, maxRowsProp],
  );
  const limit = typeof maxLength === 'number' ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  return (
    <textarea
      {...props}
      ref={(node) => {
        ctx.inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      id={ctx.inputId}
      name={ctx.name}
      disabled={ctx.disabled}
      maxLength={maxLength}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={mergeDescribedBy(ctx.describedBy, describedBy, counterMounted && limit !== undefined ? ctx.hintId : undefined)}
      aria-labelledby={ctx.labelledBy}
      aria-label={ctx.ariaLabel}
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
  chips: string[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onCommit: (value: string) => void;
  onChipRemove: (index: number, value: string) => void;
  commitKeys?: readonly ChipCommitKey[];
  maxRows?: number;
  chipLayout?: 'inline' | 'row';
  removeOnBackspace?: boolean;
  chipDismissLabel?: (value: string) => string;
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
  chipDismissLabel,
  overflowLabel,
  className,
  onKeyDown: onKeyDownProp,
  ref,
  setChips: _setChips,
  setInputValue: _setInputValue,
  reset: _reset,
  ...props
}: FieldChipInputProps & { setChips?: unknown; setInputValue?: unknown; reset?: unknown }) {
  const field = useField();
  const flowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const keys = useMemo(() => resolveCommitKeys(commitKeys), [commitKeys]);
  const keySet = useMemo(() => new Set<string>(keys), [keys]);
  const inRow = chipLayout === 'row';
  const plan = useChipMeasure({
    chips,
    maxRows,
    flowRef,
    measureRef,
    inputRef: inRow ? undefined : field.inputRef,
  });
  const hidden = maxRows == null ? 0 : plan.hidden;
  const live = chips.map((value, index) => ({ value, index })).slice(0, chips.length - hidden);

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

  const chipNodes = live.map(({ value, index }, i) => {
    const ellipsis = hidden > 0 && plan.lastChipWidth != null && i === live.length - 1;
    return (
      <Chip
        key={`${index}:${value}`}
        disabled={field.disabled}
        dismissLabel={chipDismissLabel?.(value)}
        data-ellipsis={ellipsis ? '' : undefined}
        style={ellipsis ? { maxWidth: plan.lastChipWidth } : undefined}
        onDismiss={() => {
          onChipRemove(index, value);
          field.inputRef.current?.focus();
        }}
      >
        {value}
      </Chip>
    );
  });
  const overflow = hidden > 0 ? <Chip.Overflow overflowCount={hidden} overflowLabel={overflowLabel} /> : null;
  const input = (
    <input
      {...props}
      ref={(node) => {
        field.inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      id={field.inputId}
      name={field.name}
      disabled={field.disabled}
      aria-invalid={field.invalid || undefined}
      aria-describedby={field.describedBy}
      aria-labelledby={field.labelledBy}
      aria-label={field.ariaLabel}
      value={inputValue}
      type="text"
      className={[styles.input, className].filter(Boolean).join(' ')}
      onChange={(event) => onInputValueChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
  const measure =
    maxRows != null ? (
      <div ref={measureRef} className={styles.measure} aria-hidden inert>
        {chips.map((value, index) => (
          <Chip key={`m:${index}:${value}`} onDismiss={() => undefined} disabled={field.disabled}>
            {value}
          </Chip>
        ))}
        <Chip onDismiss={() => undefined} disabled={field.disabled}>
          …
        </Chip>
        <Chip.Overflow overflowCount={chips.length || 1} overflowLabel={overflowLabel} />
      </div>
    ) : null;

  if (inRow) {
    return (
      <div className={styles.flow} ref={flowRef} data-chip-layout="row">
        {chips.length > 0 ? (
          <div
            className={styles.row}
            data-max-rows={maxRows ?? undefined}
            data-measured={maxRows != null && plan.measured ? '' : undefined}
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
      ref={flowRef}
      data-max-rows={maxRows ?? undefined}
      data-measured={maxRows != null && plan.measured ? '' : undefined}
      style={maxRows != null ? ({ '--todae-field-chip-rows': maxRows } as CSSProperties) : undefined}
    >
      {chipNodes}
      {overflow}
      {input}
      {measure}
    </div>
  );
}

export type FieldCounterProps = {
  className?: string;
  style?: CSSProperties;
};

let warnedOutsideRoot = false;
let warnedNoInput = false;

function liveCopy(remaining: number) {
  if (remaining <= 0) return 'Character limit reached';
  if (remaining === 1) return '1 character left';
  return `${remaining} characters left`;
}

function CounterMissing() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || warnedOutsideRoot) return;
    warnedOutsideRoot = true;
    console.warn('Field.Counter must render inside Field.Root');
  }, []);
  return null;
}

function CounterInner({
  ctx,
  className,
  style,
}: FieldCounterProps & { ctx: FieldContextValue }) {
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
      data-todae-counter=""
      data-limit={atLimit ? '' : undefined}
      data-over={over ? '' : undefined}
      data-invalid={ctx.invalid ? '' : undefined}
      data-disabled={ctx.disabled ? '' : undefined}
      className={[styles.counter, className].filter(Boolean).join(' ')}
      style={style}
    >
      <span aria-hidden="true">{max === undefined ? String(count) : `${count} / ${max}`}</span>
      {max === undefined ? null : (
        <>
          <span id={ctx.hintId} className={styles.srOnly}>
            {`Up to ${max} characters`}
          </span>
          <span className={styles.srOnly} aria-live="polite">
            {remaining !== undefined && remaining <= 20 ? liveCopy(remaining) : ''}
          </span>
        </>
      )}
    </span>
  );
}

function Counter({ className, style }: FieldCounterProps) {
  const ctx = useContext(FieldContext);
  if (!ctx) return <CounterMissing />;
  return <CounterInner ctx={ctx} className={className} style={style} />;
}

export type FieldRowProps = {
  children?: ReactNode;
  className?: string;
};

function Row({ children, className }: FieldRowProps) {
  return <div className={[styles.row, className].filter(Boolean).join(' ')}>{children}</div>;
}

export const Field = { Root, TextInput, Textarea, ChipInput, Icon, Affix, Counter, Row } as const;
