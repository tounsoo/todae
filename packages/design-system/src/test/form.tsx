import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { expect } from 'vitest';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Field } from '../components/Field.js';
import { Form, type FormErrors } from '../components/Form.js';
import { Label } from '../components/Label.js';

/** Renders, then lets the scopes read their controls: they do so in a microtask after each commit. */
export async function mount(ui: ReactNode) {
  const result = render(ui);
  await settle();
  return result;
}

export async function settle() {
  await act(async () => {});
}

export async function type(el: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(el, { target: { value } });
  });
}

export async function blur(el: HTMLElement) {
  await act(async () => {
    fireEvent.blur(el);
    // A blur with no relatedTarget is judged once focus settles.
    await new Promise((resolve) => setTimeout(resolve));
  });
}

export async function submit(form: HTMLElement) {
  await act(async () => {
    fireEvent.submit(form);
  });
}

/** Every id an aria-describedby names must exist in the page. */
export function expectNoDanglingIds() {
  for (const el of document.querySelectorAll('[aria-describedby]')) {
    for (const id of el.getAttribute('aria-describedby')!.split(/\s+/)) {
      expect(document.getElementById(id), `#${id} named by ${el.tagName}`).not.toBeNull();
    }
  }
}

export function EmailField({ required = true, message }: { required?: boolean; message?: ReactNode }) {
  const [email, setEmail] = useState('');
  return (
    <Field.Group data-testid="group">
      <Label.Root htmlFor="email">Work email</Label.Root>
      <Field.Root id="email" name="email">
        <Field.TextInput type="email" required={required} value={email} onValueChange={setEmail} />
      </Field.Root>
      {message ?? <ErrorMessage.Root />}
    </Field.Group>
  );
}

export function SignUp({
  errors,
  onSubmit = (event) => event.preventDefault(),
  children,
}: {
  errors?: FormErrors;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
}) {
  return (
    <Form.Root data-testid="form" errors={errors} onSubmit={onSubmit}>
      {children ?? <EmailField />}
      <button type="submit">Send</button>
    </Form.Root>
  );
}

export const input = () => screen.getByLabelText('Work email') as HTMLInputElement;
