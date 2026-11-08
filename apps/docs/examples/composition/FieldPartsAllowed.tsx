'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function FieldPartsAllowed() {
  const [value, setValue] = useState('12');
  return (
    <Field.Root aria-label="Amount">
      <Field.Icon>
        <span>⌕</span>
      </Field.Icon>
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      <Field.Affix>USD</Field.Affix>
    </Field.Root>
  );
}
