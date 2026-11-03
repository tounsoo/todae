import {
  createContext,
  useContext,
  useReducer,
  useRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { useDomId } from '../internal/domId.js';
import { useControlledState } from '../hooks/useControlledState.js';
import { useCustomValidity } from './customValidity.js';
import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { useRevalidate } from './Form.context.js';
import { useFormReset } from '../internal/formReset.js';
import { useComposedRefs } from '../internal/props.js';
import { SelectionControl } from './SelectionControl.js';
import { warnOnce } from '../internal/warnOnce.js';
import { cx } from '../internal/cx.js';
import styles from './selection.module.css';

type RadioGroupName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

export type RadioGroupOrientation = 'vertical' | 'horizontal';

export type RadioGroupRootProps = {
  children?: ReactNode;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * A message for a rule the browser can't check, set with
   * `setCustomValidity` on the group's first radio that takes part in validation. Empty or undefined means the rule holds.
   */
  customValidity?: string;
  orientation?: RadioGroupOrientation;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
} & RadioGroupName &
  Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children' | 'aria-label' | 'aria-labelledby' | 'id'>;

export type RadioGroupItemProps = {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'role' | 'checked' | 'defaultChecked' | 'children' | 'disabled' | 'name' | 'value'
>;

type RadioGroupContextValue = {
  name: string;
  value: string | null;
  disabled: boolean;
  invalid: boolean;
  select: (value: string) => void;
};

const RadioGroupContext = /* @__PURE__ */ createContext<RadioGroupContextValue | null>(null);

function useRadioGroup(): RadioGroupContextValue {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) throw new Error('RadioGroup.Item must render inside RadioGroup.Root');
  return ctx;
}

function RadioGroupRoot({
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  name: nameProp,
  disabled,
  invalid,
  customValidity,
  orientation = 'vertical',
  className,
  id,
  ref,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': describedBy,
  ...props
}: RadioGroupRootProps) {
  if (valueProp !== undefined && defaultValue !== undefined) {
    warnOnce('RadioGroup.Root:value', 'RadioGroup.Root cannot take both value and defaultValue', 'error');
  }
  const autoName = useDomId();
  const name = nameProp ?? autoName;
  const { disabled: isDisabled, invalid: isInvalid, errorId } = useFieldsetState({ disabled, invalid });
  const groupRef = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(groupRef, ref);
  useCustomValidity(
    groupRef,
    () => [...(groupRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])].find((radio) => radio.willValidate),
    customValidity,
  );
  useRevalidate();
  const [value, select] = useControlledState<string | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange &&
      ((next) => {
        if (next !== null) onValueChange(next);
      }),
  );
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  // A reset checks each radio whose `defaultChecked` React set from the value it mounted with, so the last in tree order wins, or none, and fires no change event. A controlled group whose owner turns the reset down renders again, so React writes `checked` back.
  useFormReset(groupRef, () => {
    const radios = groupRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [];
    const picked = [...radios].reverse().find((radio) => radio.name === name && radio.defaultChecked)?.value ?? null;
    if (picked === value) return;
    select(picked);
    rerender();
  });
  return (
    <RadioGroupContext.Provider
      value={{
        name,
        value,
        disabled: isDisabled,
        invalid: isInvalid,
        select,
      }}
    >
      <div
        {...props}
        ref={refs}
        id={id}
        role="radiogroup"
        className={cx(styles.group, className)}
        data-orientation={orientation}
        aria-orientation={orientation}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={mergeDescribedBy(describedBy, errorId)}
        aria-disabled={isDisabled || undefined}
        aria-invalid={isInvalid || undefined}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

function RadioGroupItem({ value, children, disabled, className, ...props }: RadioGroupItemProps) {
  const group = useRadioGroup();
  return (
    <SelectionControl
      kind="radio"
      checked={group.value === value}
      onChecked={() => group.select(value)}
      disabled={disabled || group.disabled}
      invalid={group.invalid}
      name={group.name}
      value={value}
      className={className}
      {...props}
    >
      {children}
    </SelectionControl>
  );
}

export const RadioGroup = { Root: RadioGroupRoot, Item: RadioGroupItem } as const;
