'use client';

import { Code, DataList, Field, formatTime, Label, parseTime, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// What parseTime reads from the text, and how formatTime writes it back.
export default function TimeRoundTrip({ locale }: { locale: string }) {
  const id = useId();
  const [text, setText] = useState('2130');
  const value = parseTime(text, { locale });
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Opens at</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput value={text} onChange={(event) => setText(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <DataList.Root aria-label="Round trip">
        <DataList.Item>
          <DataList.Term>parseTime</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : value.toString()}</Code.Root>
          </DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>formatTime</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : formatTime(value, { locale })}</Code.Root>
          </DataList.Details>
        </DataList.Item>
      </DataList.Root>
    </Stack.Root>
  );
}
