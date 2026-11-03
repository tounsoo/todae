'use client';

import { Field, Label, formatDateRange, parseDateRange, type DateRange } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldDateRangePicked({ locale }: { locale: string }) {
  const id = useId();
  const [range, setRange] = useState<DateRange | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Stay</Label.Root>
      <Field.Root id={id} invalid={invalid}>
        <Field.TextInput
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setRange(parseDateRange(event.target.value, { locale }));
            setInvalid(false);
          }}
          onBlur={() => {
            if (range) setText(formatDateRange(range, { locale }));
            else setInvalid(text.trim() !== '');
          }}
        />
        <Field.DateRangePicker
          value={range}
          onValueChange={(next) => {
            setRange(next);
            setText(formatDateRange(next, { locale }));
            setInvalid(false);
          }}
          locale={locale}
          showValue={false}
        />
      </Field.Root>
    </Field.Group>
  );
}
