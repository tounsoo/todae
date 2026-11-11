'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterDefault() {
  const [value, setValue] = useState('Hello');
  return (
    <Field.Root aria-label="Username">
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
      <Field.Counter />
    </Field.Root>
  );
}
