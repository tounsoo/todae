import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { SelectionControl } from './SelectionControl';

export type CheckboxRootProps = {
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

function Root({
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  children,
  ...props
}: CheckboxRootProps) {
  if (process.env.NODE_ENV !== 'production' && checkedProp !== undefined && defaultChecked !== undefined) {
    console.error('Checkbox.Root cannot take both checked and defaultChecked');
  }
  const [checked, setChecked] = useControlledState(checkedProp, defaultChecked ?? false);
  return (
    <SelectionControl
      kind="checkbox"
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

export const Checkbox = { Root } as const;
