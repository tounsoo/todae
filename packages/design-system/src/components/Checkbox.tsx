import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { SelectionControl } from './SelectionControl.js';

export type CheckboxRootProps = {
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * A message for a rule the browser can't check, set with
   * `setCustomValidity` on the checkbox. An empty string or undefined means the rule holds.
   */
  customValidity?: string;
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
