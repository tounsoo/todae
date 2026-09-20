import {
  createContext,
  useContext,
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { SelectionControl } from './SelectionControl';
import styles from './selection.module.css';

type RadioGroupName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

export type RadioGroupOrientation = 'vertical' | 'horizontal';

export type RadioGroupProps = {
  children?: ReactNode;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  orientation?: RadioGroupOrientation;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
} & RadioGroupName &
  Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children' | 'aria-label' | 'aria-labelledby' | 'id'>;

export type RadioProps = {
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

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroup(): RadioGroupContextValue {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) throw new Error('Radio must render inside RadioGroup');
  return ctx;
}

export function RadioGroup({
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  name: nameProp,
  disabled,
  invalid,
  orientation = 'vertical',
  className,
  id,
  ref,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: RadioGroupProps) {
  if (process.env.NODE_ENV !== 'production' && valueProp !== undefined && defaultValue !== undefined) {
    console.error('RadioGroup cannot take both value and defaultValue');
  }
  const autoName = useId();
  const name = nameProp ?? autoName;
  const [value, setValue] = useControlledState(valueProp, defaultValue ?? null);
  return (
    <RadioGroupContext.Provider
      value={{
        name,
        value,
        disabled: Boolean(disabled),
        invalid: Boolean(invalid),
        select: (next) => {
          setValue(next);
          onValueChange?.(next);
        },
      }}
    >
      <div
        {...props}
        ref={ref}
        id={id}
        role="radiogroup"
        className={[styles.group, className].filter(Boolean).join(' ')}
        data-orientation={orientation}
        aria-orientation={orientation}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export function Radio({ value, children, disabled, className, ...props }: RadioProps) {
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
