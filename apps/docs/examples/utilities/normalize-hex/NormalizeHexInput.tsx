'use client';

import { Code, Field, Label, normalizeHex, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function NormalizeHexInput() {
  const id = useId();
  const [text, setText] = useState('f80');
  const hex = normalizeHex(text);
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Brand color</Label.Root>
        <Field.Root id={id} name="brand" invalid={hex === null}>
          <Field.TextInput value={text} onChange={(event) => setText(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <Code.Root>{hex ?? 'null'}</Code.Root>
    </Stack.Root>
  );
}
