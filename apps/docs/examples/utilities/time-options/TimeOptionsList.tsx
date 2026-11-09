'use client';

import { OptionList, timeOptions } from '@tounsoo/todae';
import { useState } from 'react';

// Office hours, one slot an hour; the list keys each option by its ISO value, not its label.
export default function TimeOptionsList({ locale }: { locale: string }) {
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  const options = timeOptions({
    step: 60,
    min: Temporal.PlainTime.from('09:00'),
    max: Temporal.PlainTime.from('17:00'),
    value: time,
    locale,
  });
  return (
    <OptionList.Root
      aria-label="Call times"
      value={time?.toString() ?? null}
      onValueChange={(next) => setTime(Temporal.PlainTime.from(next))}
      style={{ maxInlineSize: '16rem' }}
    >
      {options.map((option) => (
        <OptionList.Option key={option.value} value={option.value}>
          {option.label}
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}
