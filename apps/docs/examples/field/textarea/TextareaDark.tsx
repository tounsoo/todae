'use client';

import { Field, ThemeProvider } from '@tounsoo/todae';
import { useState } from 'react';

export default function TextareaDark() {
  const [value, setValue] = useState('Dark scrollbar\n'.repeat(8).trim());
  return (
    <ThemeProvider appearance="dark">
      <Field.Root aria-label="Note">
        <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} maxRows={4} />
      </Field.Root>
    </ThemeProvider>
  );
}
