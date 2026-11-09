'use client';

import { Code, Field, Label, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The value changes when the text is committed: on blur, on Enter, or when the form is submitted.
export default function FieldTimeInputAlone({ locale }: { locale: string }) {
  const id = useId();
  const [opens, setOpens] = useState<Temporal.PlainTime | null>(null);
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Opens at</Label.Root>
        <Field.Root id={id} name="opens">
          <Field.TimeInput value={opens} onValueChange={setOpens} locale={locale} />
        </Field.Root>
      </Field.Group>
      <Code.Root>{opens ? opens.toString() : 'null'}</Code.Root>
    </Stack.Root>
  );
}
