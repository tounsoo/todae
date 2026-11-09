'use client';

import { Code, Field, Label, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The value changes when the text is committed: on blur, on Enter, or when the form is submitted.
export default function FieldDateTimeInputAlone({ locale }: { locale: string }) {
  const id = useId();
  const [departs, setDeparts] = useState<Temporal.PlainDateTime | null>(null);
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Departs</Label.Root>
        <Field.Root id={id} name="departs">
          <Field.DateTimeInput value={departs} onValueChange={setDeparts} locale={locale} />
        </Field.Root>
      </Field.Group>
      <Code.Root>{departs ? departs.toString() : 'null'}</Code.Root>
    </Stack.Root>
  );
}
