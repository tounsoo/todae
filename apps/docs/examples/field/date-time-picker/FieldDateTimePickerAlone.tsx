'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldDateTimePickerAlone({ locale }: { locale: string }) {
  const id = useId();
  const [start, setStart] = useState<Temporal.PlainDateTime | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Departs</Label.Root>
      <Field.Root id={id}>
        <Field.DateTimePicker
          value={start}
          onValueChange={setStart}
          locale={locale}
          placeholder="Pick a date and time"
        />
      </Field.Root>
    </Field.Group>
  );
}
