import { fireEvent, screen } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { Field } from '../index.js';

export type NumberProps = Partial<ComponentProps<typeof Field.NumberInput>>;

/** A controlled number input, which reports each commit to `onCommit`. */
export function Quantity({
  initial = null,
  onCommit,
  buttons,
  ...props
}: NumberProps & { initial?: number | null; onCommit?: (value: number | null) => void; buttons?: boolean }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <Field.Root aria-label="Quantity" name="quantity">
      {buttons ? <Field.Decrement /> : null}
      <Field.NumberInput
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onCommit?.(next);
        }}
        {...props}
      />
      {buttons ? <Field.Increment /> : null}
    </Field.Root>
  );
}

export const input = () => screen.getByRole('spinbutton') as HTMLInputElement;
export const valueInput = () => document.querySelector<HTMLInputElement>('[data-todae-value-input]')!;
export const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
export const key = (name: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(input(), { key: name, ...init });
// A step button's name starts with the string, and goes on with the field's label.
export const button = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) }) as HTMLButtonElement;
