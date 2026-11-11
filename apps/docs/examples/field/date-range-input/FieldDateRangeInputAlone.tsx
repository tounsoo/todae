'use client';

import { Code, Field, Label, Stack, type DateRange } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The value changes when the text is committed: on blur, on Enter, or when the form is submitted.
export default function FieldDateRangeInputAlone({ locale }: { locale: string }) {
  const id = useId();
  const [period, setPeriod] = useState<DateRange | null>(null);
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Report period</Label.Root>
        <Field.Root id={id} name="period">
          <Field.DateRangeInput value={period} onValueChange={setPeriod} locale={locale} />
        </Field.Root>
      </Field.Group>
      <Code.Root>{period ? `${period.start}/${period.end}` : 'null'}</Code.Root>
    </Stack.Root>
  );
}
