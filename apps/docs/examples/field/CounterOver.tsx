'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterOver() {
  const [value, setValue] = useState('Too long');
  return (
    <Field.Root aria-label="Code">
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={4} />
      <Field.Counter />
    </Field.Root>
  );
}
