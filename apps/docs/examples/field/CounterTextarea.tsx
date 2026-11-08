'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterTextarea() {
  const [value, setValue] = useState('Notes');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} maxLength={80} />
      <Field.Counter />
    </Field.Root>
  );
}
