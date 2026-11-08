'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldDatePickerAlone({ locale }: { locale: string }) {
  const id = useId();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Check-in</Label.Root>
      <Field.Root id={id}>
        <Field.DatePicker
          value={date}
          onValueChange={setDate}
          locale={locale}
          placeholder="Pick a date"
        />
      </Field.Root>
    </Field.Group>
  );
}
