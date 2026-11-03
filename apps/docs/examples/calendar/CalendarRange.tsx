'use client';

import { Calendar, Code, Stack, type DateRange } from '@tounsoo/todae';
import { useState } from 'react';

// Starts on a fixed month, so every visit shows the same days. A product would start from today.
export default function CalendarRange({ locale }: { locale: string }) {
  const [range, setRange] = useState<DateRange | null>({
    start: Temporal.PlainDate.from('2026-10-12'),
    end: Temporal.PlainDate.from('2026-10-16'),
  });
  return (
    <Stack.Root gap="condensed">
      <Calendar.Root aria-label="Stay" locale={locale} mode="range" value={range} onValueChange={setRange}>
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>
      <Code.Root>{range ? `${range.start}/${range.end}` : 'null'}</Code.Root>
    </Stack.Root>
  );
}
