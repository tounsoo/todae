'use client';

import { Description, Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function DescriptionSibling() {
  const id = useId();
  const hintId = useId();
  const [value, setValue] = useState('');
  return (
    <div className="labelled-field">
      <Label htmlFor={id}>Work email</Label>
      <Field.Root id={id} aria-describedby={hintId}>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
      <div className="messages">
        <Description id={hintId}>We only use this for billing receipts.</Description>
      </div>
    </div>
  );
}
