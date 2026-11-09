'use client';

import { Code, Field, Label, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The value changes when the text is committed: on blur, on Enter, or when the form is submitted.
export default function FieldDateInputAlone({ locale }: { locale: string }) {
  const id = useId();
  const [birthday, setBirthday] = useState<Temporal.PlainDate | null>(null);
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Date of birth</Label.Root>
        <Field.Root id={id} name="birthday">
          <Field.DateInput value={birthday} onValueChange={setBirthday} locale={locale} />
        </Field.Root>
      </Field.Group>
      <Code.Root>{birthday ? birthday.toString() : 'null'}</Code.Root>
    </Stack.Root>
  );
}
