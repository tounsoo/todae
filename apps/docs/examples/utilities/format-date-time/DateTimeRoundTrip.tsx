'use client';

import { Code, DataList, Field, formatDateTime, Label, parseDateTime, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// What parseDateTime reads from the text, and how formatDateTime writes it back.
export default function DateTimeRoundTrip({ locale }: { locale: string }) {
  const id = useId();
  const [text, setText] = useState('2026-10-13 21:30');
  const value = parseDateTime(text, { locale });
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Departs</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput value={text} onChange={(event) => setText(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <DataList.Root aria-label="Round trip">
        <DataList.Item>
          <DataList.Term>parseDateTime</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : value.toString()}</Code.Root>
          </DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>formatDateTime</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : formatDateTime(value, { locale })}</Code.Root>
          </DataList.Details>
        </DataList.Item>
      </DataList.Root>
    </Stack.Root>
  );
}
