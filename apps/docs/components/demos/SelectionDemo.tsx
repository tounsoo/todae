'use client';

import { Button, Checkbox, Field, Stack, Text, useSelection } from '@tounsoo/todae';

const FILES = ['report.pdf', 'budget.xlsx', 'notes.txt', 'photo.png', 'archive.zip'];

export function SelectFiles() {
  const selection = useSelection({ keys: FILES, disabledKeys: ['archive.zip'], defaultValue: ['notes.txt'] });
  return (
    <Stack.Root gap="condensed" align="start">
      <Checkbox.Root {...selection.getSelectAllProps()}>Select all files</Checkbox.Root>
      <Field.Group>
        {FILES.map((file) => (
          <Checkbox.Root key={file} {...selection.getCheckboxProps(file)}>
            {file}
          </Checkbox.Root>
        ))}
      </Field.Group>
      <Stack.Root gap="condensed" direction="row" wrap align="center">
        <Button.Root variant="secondary" onClick={selection.clear}>
          Clear selection
        </Button.Root>
        <Text.Root>{`${selection.value.length} selected`}</Text.Root>
      </Stack.Root>
    </Stack.Root>
  );
}
