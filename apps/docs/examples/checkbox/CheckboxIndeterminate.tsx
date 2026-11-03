'use client';

import { Checkbox, Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function CheckboxIndeterminate() {
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
