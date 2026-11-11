'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function FieldStates() {
  const [value, setValue] = useState('');
  return (
    <>
      <Field.Root aria-label="Idle field">
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} placeholder="Idle" />
      </Field.Root>
      <Field.Root aria-label="Disabled field" disabled>
        <Field.TextInput value="Disabled" onChange={() => undefined} />
      </Field.Root>
      <Field.Root aria-label="Invalid field" invalid>
        <Field.TextInput value="Invalid" onChange={() => undefined} />
      </Field.Root>
    </>
  );
}
