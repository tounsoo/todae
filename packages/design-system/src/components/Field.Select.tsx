import type { ChangeEvent, ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { cx } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { hasGlyph } from './glyphs.js';
import { valueChangeHandler } from './Field.shared.js';

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

export function Select({ value, onChange, onValueChange, className, children, ...props }: FieldSelectProps) {
  const field = useField();
  const { chevron } = useGlyphs();
  return (
    <>
      <select
        {...field.getControlProps(props)}
        value={value}
        className={cx(styles.select, className)}
        // Without either handler the select is read-only, and React says so.
        onChange={valueChangeHandler(onChange, onValueChange)}
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
