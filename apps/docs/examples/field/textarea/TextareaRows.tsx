'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function TextareaRows() {
  const [value, setValue] = useState('Notes');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
    </Field.Root>
  );
}
