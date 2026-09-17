import {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Chip } from './Chip';
import { resolveCommitKeys, type ChipCommitKey } from './commitKeys';
import {
  FieldRoot,
  IconEnd,
  IconStart,
  Prefix,
  Suffix,
  collectFieldParts,
  fieldStyles,
  useField,
  type FieldShellProps,
} from './FieldShell';
import styles from './ChipField.module.css';
import { useChipMeasure } from './useChipMeasure';

export type ChipFieldProps = FieldShellProps & {
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
  children?: ReactNode;
};

export type ChipFieldInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'disabled' | 'type'
>;

type ChipFieldInner = {
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const ChipFieldContext = createContext<ChipFieldInner | null>(null);

function useChipFieldInner(): ChipFieldInner {
  const ctx = useContext(ChipFieldContext);
  if (!ctx) throw new Error('ChipField.Input must render inside ChipField');
  return ctx;
}

function ChipFieldInput({ className, ...props }: ChipFieldInputProps) {
  const field = useField();
  const chip = useChipFieldInner();
  return (
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
      value={chip.inputValue}
      type="text"
      className={[fieldStyles.input, className].filter(Boolean).join(' ')}
      onChange={(event) => chip.onInputValueChange(event.target.value)}
      onKeyDown={chip.onKeyDown}
    />
  );
}

function ChipFieldFlow({
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
  disabled,
  input,
}: Omit<ChipFieldProps, 'children' | 'className' | 'style' | 'id' | 'name'> & {
  input: ReactNode;
}) {
  const { inputRef } = useField();
  const flowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const keys = useMemo(() => resolveCommitKeys(commitKeys), [commitKeys]);
  const keySet = useMemo(() => new Set<string>(keys), [keys]);
  const plan = useChipMeasure({ chips, maxRows, flowRef, measureRef, inputRef });
  const hidden = maxRows == null ? 0 : plan.hidden;
  const live = chips.map((value, index) => ({ value, index })).slice(hidden);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

  return (
    <ChipFieldContext.Provider value={{ inputValue, onInputValueChange, onKeyDown }}>
      <div
        className={styles.flow}
        ref={flowRef}
        data-max-rows={maxRows ?? undefined}
        data-measured={maxRows != null && plan.measured ? '' : undefined}
        style={
          maxRows != null
            ? ({ '--todae-chipfield-rows': maxRows } as CSSProperties)
            : undefined
        }
      >
        {live.map(({ value, index }) => (
          <Chip
            key={`${index}:${value}`}
            disabled={disabled}
            dismissLabel={chipDismissLabel?.(value)}
            onDismiss={() => {
              onChipRemove(index, value);
              inputRef.current?.focus();
            }}
          >
            {value}
          </Chip>
        ))}
        {hidden > 0 ? <Chip.Overflow overflowCount={hidden} overflowLabel={overflowLabel} /> : null}
        {input}
        {maxRows != null ? (
          <div ref={measureRef} className={styles.measure} aria-hidden inert>
            {chips.map((value, index) => (
              <Chip key={`m:${index}:${value}`} onDismiss={() => undefined} disabled={disabled}>
                {value}
              </Chip>
            ))}
            <Chip.Overflow overflowCount={chips.length || 1} overflowLabel={overflowLabel} />
          </div>
        ) : null}
      </div>
    </ChipFieldContext.Provider>
  );
}

export function ChipField({
  chips,
  inputValue,
  onInputValueChange,
  onCommit,
  onChipRemove,
  commitKeys,
  maxRows,
  removeOnBackspace,
  chipDismissLabel,
  overflowLabel,
  children,
  ...shell
}: ChipFieldProps) {
  const slots = collectFieldParts(children);
  const inputChild = slots.rest.find((child) => isValidElement(child) && child.type === ChipFieldInput);
  return (
    <FieldRoot {...shell}>
      {slots.iconStart}
      {slots.prefix}
      <ChipFieldFlow
        chips={chips}
        inputValue={inputValue}
        onInputValueChange={onInputValueChange}
        onCommit={onCommit}
        onChipRemove={onChipRemove}
        commitKeys={commitKeys}
        maxRows={maxRows}
        removeOnBackspace={removeOnBackspace}
        chipDismissLabel={chipDismissLabel}
        overflowLabel={overflowLabel}
        disabled={shell.disabled}
        invalid={shell.invalid}
        input={inputChild ?? <ChipFieldInput />}
      />
      {slots.suffix}
      {slots.iconEnd}
    </FieldRoot>
  );
}

ChipField.Input = ChipFieldInput;
ChipField.IconStart = IconStart;
ChipField.IconEnd = IconEnd;
ChipField.Prefix = Prefix;
ChipField.Suffix = Suffix;
