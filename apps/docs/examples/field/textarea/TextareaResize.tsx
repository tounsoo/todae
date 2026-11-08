'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function TextareaResize() {
  const [value, setValue] = useState('Drag between rows and maxRows.');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} maxRows={6} />
    </Field.Root>
  );
}
