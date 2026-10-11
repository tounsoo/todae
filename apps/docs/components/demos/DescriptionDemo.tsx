'use client';

import { Description, Field, Label } from '@omsoo/todae';
import { useId, useState } from 'react';

export function DescriptionSibling() {
  const id = useId();
  const hintId = useId();
  const [value, setValue] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Work email</Label.Root>
      <Field.Root id={id} aria-describedby={hintId}>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
      <Description.Root id={hintId}>We only use this for billing receipts.</Description.Root>
    </Field.Group>
  );
}
