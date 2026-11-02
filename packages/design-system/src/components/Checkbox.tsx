import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { warnOnce } from './warnOnce.js';
import { SelectionControl } from './SelectionControl.js';

export type CheckboxRootProps = {
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** The mixed state, such as a select-all box over a partly selected list. Sets the input's `indeterminate` and shows the `indeterminate` glyph in place of the check. A click still toggles `checked`. */
  indeterminate?: boolean;
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
  if (checkedProp !== undefined && defaultChecked !== undefined) {
    warnOnce('Checkbox.Root:checked', 'Checkbox.Root cannot take both checked and defaultChecked', 'error');
  }
  const [checked, setChecked] = useControlledState(checkedProp, defaultChecked ?? false, onCheckedChange);
  return (
    <SelectionControl
      kind="checkbox"
      checked={checked}
      onChecked={setChecked}
      {...props}
    >
      {children}
    </SelectionControl>
  );
}

export const Checkbox = { Root } as const;
