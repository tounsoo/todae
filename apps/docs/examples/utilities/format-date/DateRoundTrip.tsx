'use client';

import { Code, DataList, Field, formatDate, Label, parseDate, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// What parseDate reads from the text, and how formatDate writes it back.
export default function DateRoundTrip({ locale }: { locale: string }) {
  const id = useId();
  const [text, setText] = useState('2026-10-13');
  const value = parseDate(text, { locale });
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Due date</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput value={text} onChange={(event) => setText(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <DataList.Root aria-label="Round trip">
        <DataList.Item>
          <DataList.Term>parseDate</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : value.toString()}</Code.Root>
          </DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>formatDate</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : formatDate(value, { locale })}</Code.Root>
          </DataList.Details>
        </DataList.Item>
      </DataList.Root>
    </Stack.Root>
  );
}
