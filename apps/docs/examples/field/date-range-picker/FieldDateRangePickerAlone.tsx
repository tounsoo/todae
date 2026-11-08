'use client';

import { Field, Label, type DateRange } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldDateRangePickerAlone({ locale }: { locale: string }) {
  const id = useId();
  const [range, setRange] = useState<DateRange | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Trip dates</Label.Root>
      <Field.Root id={id}>
        <Field.DateRangePicker
          value={range}
          onValueChange={setRange}
          locale={locale}
          placeholder="Pick dates"
        />
      </Field.Root>
    </Field.Group>
  );
}
