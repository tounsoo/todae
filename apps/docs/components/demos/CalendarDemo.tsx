'use client';

import { Calendar, Code, Stack } from '@omsoo.design/todae';
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
