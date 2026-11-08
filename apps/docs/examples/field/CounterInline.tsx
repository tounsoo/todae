'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterInline() {
  const [value, setValue] = useState('Hello');
  const [note, setNote] = useState('Notes');
  return (
    <>
      <Field.Root aria-label="Username">
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
        <Field.Counter style={{ flexBasis: 'auto' }} />
      </Field.Root>
      <Field.Root aria-label="Username">
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
      <Field.Root aria-label="Note">
        <Field.Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={80} />
        <Field.Counter style={{ flexBasis: 'auto' }} />
      </Field.Root>
      <Field.Root aria-label="Note">
        <Field.Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </Field.Root>
    </>
  );
}
