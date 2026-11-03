'use client';

import { Field, Label, formatDate, parseDate } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldDatePicked({ locale }: { locale: string }) {
  const id = useId();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Start date</Label.Root>
      <Field.Root id={id} invalid={invalid}>
        <Field.TextInput
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDate(parseDate(event.target.value, { locale }));
            setInvalid(false);
          }}
          onBlur={() => {
            if (date) setText(formatDate(date, { locale }));
            else setInvalid(text.trim() !== '');
          }}
        />
        <Field.DatePicker
          value={date}
          onValueChange={(next) => {
            setDate(next);
            setText(formatDate(next, { locale }));
            setInvalid(false);
          }}
          locale={locale}
          showValue={false}
        />
      </Field.Root>
    </Field.Group>
  );
}
