import { useRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useCustomValidity } from './customValidity.js';
import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { useRevalidate } from './Form.context.js';
import { useComposedRefs } from './props.js';
import { CheckGlyph, glyphOr } from './glyphs.js';
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
  const { check } = useGlyphs();
  return (
    <label
      className={cx(styles.root, className)}
      data-control={kind}
      data-checked={checked ? '' : undefined}
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
            {glyphOr(check, <CheckGlyph />)}
          </span>
        ) : null}
      </span>
      <span className={styles.label}>{children}</span>
    </label>
  );
}
