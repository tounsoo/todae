'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function TextareaAutoGrow() {
  const [value, setValue] = useState('Grows up to six rows.');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} autoGrow maxRows={6} />
    </Field.Root>
  );
}
