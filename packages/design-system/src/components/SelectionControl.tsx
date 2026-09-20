import type { ChangeEvent, InputHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './selection.module.css';

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
  disabled,
  invalid,
  name,
  value,
  className,
  onChange,
  ref,
  ...props
}: SelectionControlProps) {
  const dom = SELECTION_DOM[kind];
  return (
    <label
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-control={kind}
      data-checked={checked ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
    >
      <input
        {...props}
        ref={ref}
        type={dom.type}
        role={'role' in dom ? dom.role : undefined}
        className={styles.input}
        checked={checked}
        disabled={disabled}
        name={name}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          onChange?.(event);
          if (kind === 'radio') {
            if (event.target.checked) onChecked(true);
            return;
          }
          onChecked(event.target.checked);
        }}
      />
      <span className={styles.indicator} aria-hidden="true" />
      <span className={styles.label}>{children}</span>
    </label>
  );
}
