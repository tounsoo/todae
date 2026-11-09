'use client';

import { Field, Label, OptionList, timeOptions } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The input and the list share one value, so a time typed between the steps, such as 9:07, shows in the list too.
export default function FieldTimeInputPicker({ locale }: { locale: string }) {
  const id = useId();
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Start time</Label.Root>
      <Field.Root id={id} name="start">
        <Field.TimeInput value={time} onValueChange={setTime} locale={locale} />
        <Field.Picker>
          <OptionList.Root
            aria-label="Start times"
            value={time?.toString() ?? null}
            onValueChange={(next) => setTime(Temporal.PlainTime.from(next))}
          >
            {timeOptions({ step: 15, value: time, locale }).map((option) => (
              <OptionList.Option key={option.value} value={option.value}>
                {option.label}
              </OptionList.Option>
            ))}
          </OptionList.Root>
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}
