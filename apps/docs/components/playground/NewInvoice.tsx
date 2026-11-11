'use client';

import { Button, Calendar, Dialog, ErrorMessage, Field, Form, Label, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';
import type { Kit } from './kit';
import { TODAY } from './kit';

export type NewInvoiceValues = { customer: string; amount: number; due: string };

/**
 * The New invoice dialog. Form.Root checks the fields in the page's language
 * and only calls `onCreate` once all three hold; the due date starts at the
 * payment terms from Invoice settings.
 */
export function NewInvoice({
  open,
  onOpenChange,
  kit,
  customers,
  terms,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: Kit;
  customers: readonly string[];
  /** Days from today to the default due date. */
  terms: number;
  onCreate: (values: NewInvoiceValues) => void;
}) {
  const { copy, locale } = kit;
  const ids = { customer: useId(), amount: useId(), due: useId() };
  const today = Temporal.PlainDate.from(TODAY);
  // A new key gives a fresh Form.Root, which forgets the last submit and shows no errors until the next.
  const [attempt, setAttempt] = useState(0);
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  // Undefined until the date is touched, so it follows the terms; null once it is cleared.
  const [due, setDue] = useState<Temporal.PlainDate | null | undefined>(undefined);
  const dueDate = due === undefined ? today.add({ days: terms }) : due;

  const reset = () => {
    setCustomer('');
    setAmount(null);
    setDue(undefined);
    setAttempt((count) => count + 1);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Header>
        <Dialog.Title>{copy.form.title}</Dialog.Title>
        <Dialog.Close />
      </Dialog.Header>
      <Dialog.Description>{copy.form.description}</Dialog.Description>
      <Form.Root
        key={attempt}
        onSubmit={(event) => {
          event.preventDefault();
          if (amount === null || dueDate === null) return;
          onCreate({ customer, amount, due: dueDate.toString() });
          reset();
        }}
      >
        <Stack.Root>
          <Form.Summary />
          <Field.Group>
            <Label.Root htmlFor={ids.customer}>{copy.form.customer}</Label.Root>
            <Field.Root id={ids.customer} name="customer">
              <Field.Select required value={customer} onValueChange={setCustomer}>
                <option value="">{copy.form.choose}</option>
                {customers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Field.Select>
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Field.Group>
            <Label.Root htmlFor={ids.amount}>{copy.form.amount}</Label.Root>
            <Field.Root id={ids.amount} name="amount">
              <Field.NumberInput
                required
                min={1}
                value={amount}
                onValueChange={setAmount}
                locale={locale}
                formatOptions={{ style: 'currency', currency: copy.currency }}
              />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Field.Group>
            <Label.Root htmlFor={ids.due}>{copy.form.due}</Label.Root>
            <Field.Root id={ids.due} name="due">
              <Field.DateInput required min={today} value={dueDate} onValueChange={setDue} locale={locale} />
              <Field.Picker>
                <Calendar.Root aria-label={copy.form.due} min={today} value={dueDate} onValueChange={setDue} locale={locale}>
                  <Calendar.Header />
                  <Calendar.Grid />
                </Calendar.Root>
              </Field.Picker>
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Dialog.Footer>
            <Dialog.Close variant="secondary">{copy.form.cancel}</Dialog.Close>
            <Button.Root type="submit">{copy.form.create}</Button.Root>
          </Dialog.Footer>
        </Stack.Root>
      </Form.Root>
    </Dialog.Root>
  );
}
