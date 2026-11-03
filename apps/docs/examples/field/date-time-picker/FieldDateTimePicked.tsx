'use client';

import { Field, Label, formatDateTime, parseDateTime } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldDateTimePicked({ locale }: { locale: string }) {
  const id = useId();
  const [start, setStart] = useState<Temporal.PlainDateTime | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Meeting starts</Label.Root>
      <Field.Root id={id} invalid={invalid}>
        <Field.TextInput
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setStart(parseDateTime(event.target.value, { locale }));
            setInvalid(false);
          }}
          onBlur={() => {
            if (start) setText(formatDateTime(start, { locale }));
            else setInvalid(text.trim() !== '');
          }}
        />
        <Field.DateTimePicker
          value={start}
          onValueChange={(next) => {
            setStart(next);
            setText(formatDateTime(next, { locale }));
            setInvalid(false);
          }}
          locale={locale}
          step={15}
          showValue={false}
        />
      </Field.Root>
    </Field.Group>
  );
}
