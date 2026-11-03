'use client';

import { Button, ErrorMessage, Field, Form, Label, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldOneTimeCodeForm() {
  const id = useId();
  const [code, setCode] = useState('48');
  return (
    <Form.Root onSubmit={(event) => event.preventDefault()}>
      <Stack.Root align="start">
        <Field.Group>
          <Label.Root htmlFor={id}>Recovery code</Label.Root>
          <Field.Root id={id} name="recovery">
            <Field.OneTimeCode required length={8} characters="alphanumeric" value={code} onValueChange={setCode} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Button.Root type="submit">Verify</Button.Root>
      </Stack.Root>
    </Form.Root>
  );
}
