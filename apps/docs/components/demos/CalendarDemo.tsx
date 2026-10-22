'use client';

import { Calendar, Code, Stack, type DateRange } from '@tounsoo/todae';
import { useState } from 'react';
import { useLocale } from '../../lib/i18n/useLocale';

// Starts empty, so the server render needs no today: the grid fills in after hydration.
export function CalendarInline() {
  const locale = useLocale();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  return (
    <Stack.Root gap="condensed">
      <Calendar.Root aria-label="Start date" locale={locale} value={date} onValueChange={setDate}>
        <Calendar.Header />
        <Calendar.Grid />
      </Calendar.Root>
      <Code.Root>{date ? date.toString() : 'null'}</Code.Root>
    </Stack.Root>
  );
}

// Starts on a fixed month, so the screenshot always shows the same days.
export function CalendarRange() {
  const locale = useLocale();
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
