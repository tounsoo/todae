'use client';

import { Description, Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldOneTimeCode() {
  const id = useId();
  const hintId = useId();
  const [code, setCode] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Verification code</Label.Root>
      <Field.Root id={id} name="code" aria-describedby={hintId}>
        <Field.OneTimeCode value={code} onValueChange={setCode} />
      </Field.Root>
      <Description.Root id={hintId}>Enter the 6-digit code we sent.</Description.Root>
    </Field.Group>
  );
}
