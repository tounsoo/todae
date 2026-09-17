import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import {
  FieldRoot,
  IconEnd,
  IconStart,
  Prefix,
  Suffix,
  fieldStyles,
  useField,
  type FieldAdornmentProps,
  type FieldShellProps,
} from './FieldShell';

export type TextFieldType = 'text' | 'search' | 'email' | 'url' | 'tel' | 'password';

export type TextFieldProps = FieldShellProps & {
  children?: ReactNode;
};

export type TextFieldInputProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  type?: TextFieldType;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type' | 'disabled' | 'onChange'>;

function TextFieldInput({
  value,
  onChange,
  onValueChange,
  type = 'text',
  className,
  ...props
}: TextFieldInputProps) {
  const ctx = useField();
  return (
    <input
      {...props}
      ref={ctx.inputRef}
      id={ctx.inputId}
      name={ctx.name}
      disabled={ctx.disabled}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={ctx.describedBy}
      aria-labelledby={ctx.labelledBy}
      aria-label={ctx.ariaLabel}
      value={value}
      type={type}
      className={[fieldStyles.input, className].filter(Boolean).join(' ')}
      onChange={(event) => {
        onChange(event);
        onValueChange?.(event.target.value);
      }}
    />
  );
}

export function TextField({ children, ...props }: TextFieldProps) {
  return <FieldRoot {...props}>{children}</FieldRoot>;
}

TextField.Input = TextFieldInput;
TextField.IconStart = IconStart;
TextField.IconEnd = IconEnd;
TextField.Prefix = Prefix;
TextField.Suffix = Suffix;

export type { FieldAdornmentProps, FieldShellProps };
