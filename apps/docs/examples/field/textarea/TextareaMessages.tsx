'use client';

import { Description, ErrorMessage, Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function TextareaMessages() {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const disabledId = useId();
  const [value, setValue] = useState('missing');
  const invalid = value.trim().length < 8;
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={id}>Note</Label.Root>
        <Field.Root id={id} invalid={invalid} aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}>
          <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
        </Field.Root>
        <Description.Root id={hintId}>A short description of the work.</Description.Root>
        {invalid ? <ErrorMessage.Root id={errorId}>Use at least 8 characters.</ErrorMessage.Root> : null}
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={disabledId}>Note</Label.Root>
        <Field.Root id={disabledId} disabled>
          <Field.Textarea value="Disabled" onChange={() => undefined} />
        </Field.Root>
      </Field.Group>
    </>
  );
}
