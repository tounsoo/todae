import {
  useMemo,
  useRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Chip } from './Chip.js';
import { isImeKeyEvent } from './ime.js';
import { cx, useComposedRefs } from './props.js';
import { resolveCommitKeys, type ChipCommitKey } from './commitKeys.js';
import styles from './Field.module.css';
import { useChipList } from '../hooks/useChipList.js';
import { useField } from '../hooks/useField.js';

export type FieldChipInputProps = {
  chips: readonly string[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  /** Return `false` when there was nothing to commit: Enter then goes on to the input and its form, and other commit keys stay prevented. */
  onCommit: (value: string) => boolean | void;
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

export function ChipInput({
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
    if (isImeKeyEvent(event, keys)) return;
    if (event.key === 'Backspace' && inputValue === '' && chips.length > 0 && removeOnBackspace) {
      const index = chips.length - 1;
      const value = chips[index];
      if (value === undefined) return;
      event.preventDefault();
      onChipRemove(index, value);
      return;
    }
    if (!keySet.has(event.key)) return;
    // A held key commits once; once the text is cleared, a repeated Enter would submit the form.
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed === '') return;
    // Only Enter goes on to the form; any other commit key would type its character.
    if (onCommit(trimmed) !== false || event.key !== 'Enter') event.preventDefault();
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
