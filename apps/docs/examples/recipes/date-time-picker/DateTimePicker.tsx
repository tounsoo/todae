'use client';

import { Calendar, Field, Label, OptionList, timeOptions } from '@tounsoo/todae';
import { useId, useState } from 'react';
import styles from './DateTimePicker.module.css';

// A day or a time picked while the other half is missing, held until the other is picked too.
type Halves = { date: Temporal.PlainDate | null; time: Temporal.PlainTime | null };
const NONE: Halves = { date: null, time: null };

export default function DateTimePicker({ locale }: { locale: string }) {
  const id = useId();
  const [starts, setStarts] = useState<Temporal.PlainDateTime | null>(null);
  const [held, setHeld] = useState<Halves>(NONE);
  const date = starts?.toPlainDate() ?? held.date;
  const time = starts?.toPlainTime() ?? held.time;

  // A pick keeps the other half, and makes the value, and closes the picker, once both are set.
  function pick(next: Halves, close: () => void) {
    const day = next.date ?? date;
    const at = next.time ?? time;
    if (day && at) {
      setStarts(day.toPlainDateTime(at));
      setHeld(NONE);
      close();
    } else {
      setHeld({ date: day, time: at });
    }
  }

  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Meeting starts</Label.Root>
      <Field.Root id={id} name="starts">
        <Field.DateTimeInput value={starts} onValueChange={setStarts} locale={locale} />
        {/* A half picked and then left is dropped when the picker closes. */}
        <Field.Picker
          closeOnPick={false}
          onOpenChange={(open) => {
            if (!open) setHeld(NONE);
          }}
        >
          {({ close }) => (
            <div className={styles.panel}>
              <Calendar.Root
                aria-label="Day"
                value={date}
                onValueChange={(day) => pick({ date: day, time: null }, close)}
                locale={locale}
              >
                <Calendar.Header />
                <Calendar.Grid />
              </Calendar.Root>
              <div className={styles.times}>
                <OptionList.Root
                  aria-label="Times"
                  value={time?.toString() ?? null}
                  onValueChange={(next) => pick({ date: null, time: Temporal.PlainTime.from(next) }, close)}
                >
                  {timeOptions({ step: 15, value: time, locale }).map((option) => (
                    <OptionList.Option key={option.value} value={option.value}>
                      {option.label}
                    </OptionList.Option>
                  ))}
                </OptionList.Root>
              </div>
            </div>
          )}
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}
