import { useLayoutEffect, useRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useCustomValidity } from './customValidity.js';
import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { useRevalidate } from './Form.context.js';
import { useComposedRefs } from './props.js';
import { CheckGlyph, DashGlyph, glyphOr } from './glyphs.js';
import styles from './selection.module.css';
import { cx } from './cx.js';

export type SelectionKind = 'checkbox' | 'radio' | 'switch';

export const SELECTION_DOM = {
  checkbox: { type: 'checkbox' },
  radio: { type: 'radio' },
  switch: { type: 'checkbox', role: 'switch' },
} as const;

export type SelectionControlProps = {
  kind: SelectionKind;
  checked: boolean;
  onChecked: (next: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  /** A message for a rule the browser can't check, set with `setCustomValidity`. Empty or undefined means the rule holds. */
  customValidity?: string;
  name?: string;
  value?: string;
  className?: string;
  /** Checkboxes only: the mixed state, drawn with the `indeterminate` glyph. */
  indeterminate?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'type'
  | 'role'
  | 'checked'
  | 'defaultChecked'
  | 'children'
  | 'disabled'
  | 'name'
  | 'value'
  | 'onChange'
  | 'onToggle'
>;

export function SelectionControl({
  kind,
  checked,
  onChecked,
  children,
  disabled: disabledProp,
  invalid: invalidProp,
  customValidity,
  name,
  value,
  className,
  indeterminate: indeterminateProp,
  onChange,
  ref,
  'aria-describedby': describedBy,
  ...props
}: SelectionControlProps) {
  const dom = SELECTION_DOM[kind];
  // A Fieldset.Root disables the input natively; the label follows it.
  const { disabled, invalid, errorId } = useFieldsetState({ disabled: disabledProp, invalid: invalidProp });
  const inputRef = useRef<HTMLInputElement>(null);
  const refs = useComposedRefs(inputRef, ref);
  useCustomValidity(inputRef, () => inputRef.current, customValidity);
  useRevalidate();
  const { check, indeterminate: indeterminateGlyph } = useGlyphs();
  const indeterminate = kind === 'checkbox' && !!indeterminateProp;
  // The DOM property has no attribute; onChange puts back the latest prop
  // after a click clears it.
  const indeterminateRef = useRef(indeterminate);
  useLayoutEffect(() => {
    indeterminateRef.current = indeterminate;
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label
      className={cx(styles.root, className)}
      data-control={kind}
      data-checked={checked ? '' : undefined}
      data-indeterminate={indeterminate ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
    >
      <input
        {...props}
        ref={refs}
        type={dom.type}
        role={'role' in dom ? dom.role : undefined}
        className={styles.input}
        checked={checked}
        disabled={disabled}
        name={name}
        value={value}
        aria-invalid={invalid || undefined}
        // A radio's group holds the error, so the group is described once, not each radio.
        aria-describedby={mergeDescribedBy(describedBy, kind === 'radio' ? undefined : errorId)}
        onChange={(event) => {
          onChange?.(event);
          // A click clears the mixed state; if nothing renders again, put it back.
          event.target.indeterminate = indeterminateRef.current;
          if (kind === 'radio') {
            if (event.target.checked) onChecked(true);
            return;
          }
          onChecked(event.target.checked);
        }}
      />
      <span className={styles.indicator} aria-hidden="true" data-todae-focus-ring="">
        {kind === 'checkbox' ? (
          <span className={styles.glyph} data-todae-glyph="">
            {indeterminate ? glyphOr(indeterminateGlyph, <DashGlyph />) : glyphOr(check, <CheckGlyph />)}
          </span>
        ) : null}
      </span>
      <span className={styles.label}>{children}</span>
    </label>
  );
}
