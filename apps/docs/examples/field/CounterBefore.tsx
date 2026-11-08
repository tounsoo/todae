'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterBefore() {
  const [value, setValue] = useState('Hello');
  return (
    <Field.Root aria-label="Username">
      <Field.Counter />
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
    </Field.Root>
  );
}
