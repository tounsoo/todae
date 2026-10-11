'use client';

import { Description, ErrorMessage, Field, Label } from '@omsoo/todae';
import { useId, useState } from 'react';

export function ErrorMessageSibling() {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('not-an-email');
  const invalid = email !== '' && !email.includes('@');
  const describedBy = invalid ? `${hintId} ${errorId}` : hintId;
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Work email</Label.Root>
      <Field.Root id={id} invalid={invalid} aria-describedby={describedBy}>
        <Field.TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field.Root>
      <Description.Root id={hintId}>We only use this for billing receipts.</Description.Root>
      {invalid ? <ErrorMessage.Root id={errorId}>Enter an address that contains an @.</ErrorMessage.Root> : null}
    </Field.Group>
  );
}
