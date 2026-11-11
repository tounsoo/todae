'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterPlain() {
  const [value, setValue] = useState('Hello');
  return (
    <Field.Root aria-label="Username">
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      <Field.Counter />
    </Field.Root>
  );
}
