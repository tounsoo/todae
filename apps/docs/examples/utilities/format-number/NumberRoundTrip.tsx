'use client';

import { Code, DataList, Field, formatNumber, Label, parseNumber, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

// What parseNumber reads from the text, and how formatNumber writes it back.
export default function NumberRoundTrip({ locale }: { locale: string }) {
  const id = useId();
  const [text, setText] = useState('1234.5');
  const value = parseNumber(text, { locale });
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Amount</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput value={text} onChange={(event) => setText(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <DataList.Root aria-label="Round trip">
        <DataList.Item>
          <DataList.Term>parseNumber</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : String(value)}</Code.Root>
          </DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>formatNumber</DataList.Term>
          <DataList.Details>
            <Code.Root>{value === null ? 'null' : formatNumber(value, { locale })}</Code.Root>
          </DataList.Details>
        </DataList.Item>
      </DataList.Root>
    </Stack.Root>
  );
}
