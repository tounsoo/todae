import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useControllableState } from '../hooks/useControlledState.js';
import { warnOnce } from './warnOnce.js';
import { SelectionControl } from './SelectionControl.js';

export type SwitchRootProps = {
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
}: SwitchRootProps) {
  if (checkedProp !== undefined && defaultChecked !== undefined) {
    warnOnce('Switch.Root:checked', 'Switch.Root cannot take both checked and defaultChecked', 'error');
  }
  const [checked, setChecked] = useControllableState(checkedProp, defaultChecked ?? false, onCheckedChange);
  return (
    <SelectionControl
      kind="switch"
      checked={checked}
      onChecked={setChecked}
      {...props}
    >
      {children}
    </SelectionControl>
  );
}

export const Switch = { Root } as const;
