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
