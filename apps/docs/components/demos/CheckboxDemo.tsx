'use client';

import { Checkbox, ErrorMessage, Field } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function CheckboxStates() {
  const [accepted, setAccepted] = useState(false);
  const errorId = useId();
  const invalid = !accepted;
  return (
    <>
      <Checkbox.Root defaultChecked>Product updates</Checkbox.Root>
      <Checkbox.Root disabled>Archived list</Checkbox.Root>
      <Field.Group>
        <Checkbox.Root
          checked={accepted}
          onCheckedChange={setAccepted}
          invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        >
          I accept the terms
        </Checkbox.Root>
        {invalid ? <ErrorMessage.Root id={errorId}>Accept the terms to continue.</ErrorMessage.Root> : null}
      </Field.Group>
    </>
  );
}

export function CheckboxIndeterminate() {
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const all = email && push;
  return (
    <Field.Group>
      <Checkbox.Root
        checked={all}
        indeterminate={(email || push) && !all}
        onCheckedChange={(checked) => {
          setEmail(checked);
          setPush(checked);
        }}
      >
        All notifications
      </Checkbox.Root>
      <Checkbox.Root checked={email} onCheckedChange={setEmail}>
        Email
      </Checkbox.Root>
      <Checkbox.Root checked={push} onCheckedChange={setPush}>
        Push
      </Checkbox.Root>
    </Field.Group>
  );
}
