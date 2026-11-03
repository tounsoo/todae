'use client';

import { Field, Label, formatTime, parseTime } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The picker and the input share one state, so typing and picking stay in step.
export default function FieldTimePicked({ locale }: { locale: string }) {
  const id = useId();
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Start time</Label.Root>
      <Field.Root id={id} invalid={invalid}>
        <Field.TextInput
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setTime(parseTime(event.target.value, { locale }));
            setInvalid(false);
          }}
          onBlur={() => {
            if (time) setText(formatTime(time, { locale }));
            else setInvalid(text.trim() !== '');
          }}
        />
        <Field.TimePicker
          value={time}
          onValueChange={(next) => {
            setTime(next);
            setText(formatTime(next, { locale }));
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
