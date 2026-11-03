'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldNumberPercent({ locale }: { locale: string }) {
  const id = useId();
  const [rate, setRate] = useState<number | null>(0.125);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Discount</Label.Root>
      <Field.Root id={id} name="discount">
        <Field.NumberInput
          value={rate}
          onValueChange={setRate}
          min={0}
          max={1}
          step={0.005}
          locale={locale}
          formatOptions={{ style: 'percent', maximumFractionDigits: 1 }}
        />
      </Field.Root>
    </Field.Group>
  );
}
