'use client';

import { Button, Field } from '@tounsoo/todae';
import { useState } from 'react';

function attachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 8.5 9.5 5a2 2 0 0 1 3 3L7 13.5a3 3 0 0 1-4.5-4L8 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PromptComposer() {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setValue('');
      }}
    >
      <Field.Root aria-label="Message">
        <Field.Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoGrow
          maxRows={6}
          maxLength={280}
        />
        <Field.Row>
          <Button.Root variant="ghost" aria-label="Attach file">
            <Button.Icon>{attachIcon()}</Button.Icon>
          </Button.Root>
          <Field.Counter />
          <Button.Root type="submit" variant="primary" disabled={value.trim() === ''} aria-label="Send">
            Send
          </Button.Root>
        </Field.Row>
      </Field.Root>
    </form>
  );
}

export default function RowComposer() {
  return <PromptComposer />;
}
