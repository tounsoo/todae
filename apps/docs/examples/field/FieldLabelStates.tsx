'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldLabelStates() {
  const idleId = useId();
  const disabledId = useId();
  const invalidId = useId();
  const [email, setEmail] = useState('');
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={idleId}>Email</Label.Root>
        <Field.Root id={idleId}>
          <Field.TextInput
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={disabledId}>Email</Label.Root>
        <Field.Root id={disabledId} disabled>
          <Field.TextInput value="Disabled" onChange={() => undefined} />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={invalidId}>Email</Label.Root>
        <Field.Root id={invalidId} invalid>
          <Field.TextInput value="Invalid" onChange={() => undefined} />
        </Field.Root>
      </Field.Group>
    </>
  );
}
