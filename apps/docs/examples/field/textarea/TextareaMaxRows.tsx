'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function TextareaMaxRows() {
  const [value, setValue] = useState('maxRows only');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} maxRows={2} />
    </Field.Root>
  );
}
