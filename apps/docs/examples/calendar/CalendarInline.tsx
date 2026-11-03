'use client';

import { Calendar, Code, Stack } from '@tounsoo/todae';
import { useState } from 'react';

// Starts empty, so the server render needs no today: the grid fills in after hydration.
export default function CalendarInline({ locale }: { locale: string }) {
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
