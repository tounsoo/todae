'use client';

import { Calendar, Field, Label, type DateRange } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The input and the calendar share one range, so typing and picking stay in step.
export default function FieldDateRangeInputPicker({ locale }: { locale: string }) {
  const id = useId();
  const [stay, setStay] = useState<DateRange | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Stay</Label.Root>
      <Field.Root id={id} name="stay">
        <Field.DateRangeInput value={stay} onValueChange={setStay} locale={locale} />
        <Field.Picker>
          <Calendar.Root aria-label="Stay" mode="range" value={stay} onValueChange={setStay} locale={locale}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}
