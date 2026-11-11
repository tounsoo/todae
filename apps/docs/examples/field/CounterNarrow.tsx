'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CounterNarrow() {
  const [value, setValue] = useState('Hi');
  return (
    <div style={{ width: 160 }}>
      <Field.Root aria-label="Price">
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
        <Field.Counter style={{ flexBasis: 'auto' }} />
      </Field.Root>
    </div>
  );
}
