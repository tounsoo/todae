import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { SelectionControl } from './SelectionControl';

export type SwitchProps = {
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  value?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'role' | 'checked' | 'defaultChecked' | 'children' | 'disabled' | 'name' | 'value'
>;

export function Switch({
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  children,
  ...props
}: SwitchProps) {
  if (process.env.NODE_ENV !== 'production' && checkedProp !== undefined && defaultChecked !== undefined) {
    console.error('Switch cannot take both checked and defaultChecked');
  }
  const [checked, setChecked] = useControlledState(checkedProp, defaultChecked ?? false);
  return (
    <SelectionControl
      kind="switch"
      checked={checked}
      onChecked={(next) => {
        setChecked(next);
        onCheckedChange?.(next);
      }}
      {...props}
    >
      {children}
    </SelectionControl>
  );
}
