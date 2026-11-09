'use client';

import { Calendar, Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The input and the calendar share one value, so typing and picking stay in step.
export default function FieldDateInputPicker({ locale }: { locale: string }) {
  const id = useId();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Start date</Label.Root>
      <Field.Root id={id} name="start">
        <Field.DateInput value={date} onValueChange={setDate} locale={locale} />
        <Field.Picker>
          <Calendar.Root aria-label="Start date" value={date} onValueChange={setDate} locale={locale}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}
