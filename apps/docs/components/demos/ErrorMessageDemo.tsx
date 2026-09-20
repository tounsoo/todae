'use client';

import { Description, ErrorMessage, Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function ErrorMessageSibling() {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('not-an-email');
  const invalid = email !== '' && !email.includes('@');
  const describedBy = invalid ? `${hintId} ${errorId}` : hintId;
  return (
    <div className="labelled-field">
      <Label htmlFor={id}>Work email</Label>
      <Field.Root id={id} invalid={invalid} aria-describedby={describedBy}>
        <Field.TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field.Root>
      <div className="messages">
        <Description id={hintId}>We only use this for billing receipts.</Description>
        {invalid ? <ErrorMessage id={errorId}>Enter an address that contains an @.</ErrorMessage> : null}
      </div>
    </div>
  );
}
