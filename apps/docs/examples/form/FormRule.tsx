'use client';

import { Button, ErrorMessage, Field, Form, Label, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FormRule() {
  const passwordId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <Form.Root onSubmit={(event) => event.preventDefault()}>
      <Stack.Root>
        <Field.Group>
          <Label.Root htmlFor={passwordId}>Password</Label.Root>
          <Field.Root id={passwordId} name="password">
            <Field.TextInput type="password" required minLength={8} value={password} onValueChange={setPassword} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor={confirmId}>Confirm password</Label.Root>
          <Field.Root
            id={confirmId}
            name="confirm"
            customValidity={confirm !== '' && confirm !== password ? 'The passwords do not match.' : ''}
          >
            <Field.TextInput type="password" required value={confirm} onValueChange={setConfirm} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Button.Root type="submit">Set password</Button.Root>
      </Stack.Root>
    </Form.Root>
  );
}
