'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldTimePickerAlone({ locale }: { locale: string }) {
  const id = useId();
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Opens at</Label.Root>
      <Field.Root id={id}>
        <Field.TimePicker
          value={time}
          onValueChange={setTime}
          locale={locale}
          placeholder="Pick a time"
        />
      </Field.Root>
    </Field.Group>
  );
}
