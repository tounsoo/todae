'use client';

import { Code, DataList, Field, formatDateRange, Label, parseDateRange, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// What parseDateRange reads from the text, and how formatDateRange writes it back.
export default function DateRangeRoundTrip({ locale }: { locale: string }) {
  const id = useId();
  const [text, setText] = useState('2026-10-03/2026-10-10');
  const value = parseDateRange(text, { locale });
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Stay</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput value={text} onChange={(event) => setText(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <DataList.Root aria-label="Round trip">
        <DataList.Item>
          <DataList.Term>parseDateRange</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : `${value.start.toString()}/${value.end.toString()}`}</Code.Root>
          </DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>formatDateRange</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : formatDateRange(value, { locale })}</Code.Root>
          </DataList.Details>
        </DataList.Item>
      </DataList.Root>
    </Stack.Root>
  );
}
