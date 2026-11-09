'use client';

import { Calendar, Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

// Without onValueChange the date input is read-only: it shows and sends the date, and a press on it opens the calendar.
export default function FieldPickerPickOnly({ locale }: { locale: string }) {
  const id = useId();
  const [checkIn, setCheckIn] = useState<Temporal.PlainDate | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Check-in</Label.Root>
      <Field.Root id={id} name="check-in">
        <Field.DateInput value={checkIn} locale={locale} placeholder="Pick a date" />
        <Field.Picker>
          <Calendar.Root aria-label="Check-in" value={checkIn} onValueChange={setCheckIn} locale={locale}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}
