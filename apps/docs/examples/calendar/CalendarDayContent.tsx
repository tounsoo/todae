'use client';

import { Calendar } from '@tounsoo/todae';
import { useState } from 'react';

const NOTES: Record<string, string> = {
  '2026-10-13': 'Review',
  '2026-10-20': 'Ship',
};

export default function CalendarDayContent({ locale }: { locale: string }) {
  const [date, setDate] = useState<Temporal.PlainDate | null>(() => Temporal.PlainDate.from('2026-10-13'));
  return (
    <Calendar.Root aria-label="Start date" locale={locale} value={date} onValueChange={setDate}>
      <Calendar.Header />
      <Calendar.Grid
        renderDay={(day) => {
          const note = NOTES[day.date.toString()];
          if (!note || day.outside) return null;
          return note;
        }}
      />
    </Calendar.Root>
  );
}
