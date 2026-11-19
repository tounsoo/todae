'use client';

import { Calendar } from '@tounsoo/todae';
import { useState } from 'react';

export default function CalendarOutsideDays({ locale }: { locale: string }) {
  const [date, setDate] = useState<Temporal.PlainDate | null>(() => Temporal.PlainDate.from('2026-10-13'));
  return (
    <Calendar.Root aria-label="Start date" locale={locale} value={date} onValueChange={setDate}>
      <Calendar.Header />
      <Calendar.Grid showOutsideDays />
    </Calendar.Root>
  );
}
