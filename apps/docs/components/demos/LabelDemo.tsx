'use client';

import { Field, Label } from '@omsoo/todae';
import { useId, useState } from 'react';

export function LabelSibling() {
  const id = useId();
  const [value, setValue] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Email</Label.Root>
      <Field.Root id={id}>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
    </Field.Group>
  );
}
