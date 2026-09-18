import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useMemo,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type LabelHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { Chip } from './Chip';
import { resolveCommitKeys, type ChipCommitKey } from './commitKeys';
import styles from './Field.module.css';
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
  children?: ReactNode;
};

type FieldContextValue = {
  inputId: string;
  disabled: boolean;
  invalid: boolean;
  name?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
  inputRef: RefObject<HTMLInputElement | null>;
};

const FieldContext = createContext<FieldContextValue | null>(null);

function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must render inside Field.Root');
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

export type FieldLabelProps = {
  children?: ReactNode;
  className?: string;
} & Omit<LabelHTMLAttributes<HTMLLabelElement>, 'htmlFor' | 'children'>;

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

function Label({ children, className, ...props }: FieldLabelProps) {
  const ctx = useField();
  return (
    <label {...props} htmlFor={ctx.inputId} className={[styles.label, className].filter(Boolean).join(' ')}>
      {children}
    </label>
  );
}

function isLabelElement(node: ReactNode): node is ReactElement<FieldLabelProps> {
  return isValidElement(node) && node.type === Label;
}

function partitionFieldChildren(children: ReactNode): { labels: ReactNode[]; rest: ReactNode[] } {
  const labels: ReactNode[] = [];
  const rest: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (isLabelElement(child)) labels.push(child);
    else rest.push(child);
  }
  return { labels, rest };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [tabindex]'));
}

function Root({ disabled, invalid, id, name, className, style, children, ...aria }: FieldRootProps) {
  const autoId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? autoId;
  const { labels, rest } = partitionFieldChildren(children);

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (disabled || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    inputRef.current?.focus();
  }

  return (
    <FieldContext.Provider
      value={{
        inputId,
        disabled: Boolean(disabled),
        invalid: Boolean(invalid),
        name,
        describedBy: aria['aria-describedby'],
        labelledBy: aria['aria-labelledby'],
        ariaLabel: aria['aria-label'],
        inputRef,
      }}
    >
      <div
        className={[styles.root, className].filter(Boolean).join(' ')}
        style={style}
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
      >
        {labels}
        <div
          className={styles.shell}
          data-disabled={disabled ? '' : undefined}
          data-invalid={invalid ? '' : undefined}
          onMouseDown={onMouseDown}
        >
          {rest}
        </div>
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
  ...props
}: FieldTextInputProps) {
  const ctx = useField();
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
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={ctx.describedBy}
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

export type FieldChipInputProps = {
  chips: string[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onCommit: (value: string) => void;
  onChipRemove: (index: number, value: string) => void;
  commitKeys?: readonly ChipCommitKey[];
  maxRows?: number;
  removeOnBackspace?: boolean;
  chipDismissLabel?: (value: string) => string;
  overflowLabel?: (n: number) => string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'disabled' | 'type' | 'children'>;

function ChipInput({
  chips,
  inputValue,
  onInputValueChange,
  onCommit,
  onChipRemove,
  commitKeys,
  maxRows,
  removeOnBackspace = true,
  chipDismissLabel,
  overflowLabel,
  className,
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
  const plan = useChipMeasure({ chips, maxRows, flowRef, measureRef, inputRef: field.inputRef });
  const hidden = maxRows == null ? 0 : plan.hidden;
  const live = chips.map((value, index) => ({ value, index })).slice(0, chips.length - hidden);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

  return (
    <div
      className={styles.flow}
      ref={flowRef}
      data-max-rows={maxRows ?? undefined}
      data-measured={maxRows != null && plan.measured ? '' : undefined}
      style={maxRows != null ? ({ '--todae-field-chip-rows': maxRows } as CSSProperties) : undefined}
    >
      {live.map(({ value, index }, i) => {
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
      })}
      {hidden > 0 ? <Chip.Overflow overflowCount={hidden} overflowLabel={overflowLabel} /> : null}
      <input
        {...props}
        ref={field.inputRef}
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
      {maxRows != null ? (
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
      ) : null}
    </div>
  );
}

export const Field = { Root, Label, TextInput, ChipInput, Icon, Affix } as const;
