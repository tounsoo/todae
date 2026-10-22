'use client';

import { Button, ErrorMessage, Field, Stack, Text, useInlineEdit } from '@tounsoo/todae';
import { Check, Pencil, X } from 'lucide-react';
import { useId, useState } from 'react';

export function InlineEditExample() {
  const [name, setName] = useState('Q3 report');
  const nameId = useId();
  const errorId = useId();
  const edit = useInlineEdit({
    value: name,
    // An empty name keeps the edit open, with its error showing.
    onCommit: (draft) => {
      if (draft.trim() === '') return false;
      setName(draft.trim());
    },
  });
  const invalid = edit.draft.trim() === '';

  if (edit.editing) {
    return (
      <Stack.Root {...edit.getGroupProps()} gap="condensed">
        <Stack.Root direction="row" gap="condensed" align="center">
          <Field.Root aria-label="Name" invalid={invalid} aria-describedby={invalid ? errorId : undefined}>
            <Field.TextInput {...edit.getInputProps()} />
          </Field.Root>
          <Button.Root variant="ghost" aria-label="Save" onClick={edit.commit}>
            <Button.Icon>
              <Check />
            </Button.Icon>
          </Button.Root>
          <Button.Root variant="ghost" aria-label="Cancel" onClick={edit.cancel}>
            <Button.Icon>
              <X />
            </Button.Icon>
          </Button.Root>
        </Stack.Root>
        {invalid ? <ErrorMessage.Root id={errorId}>Enter a name.</ErrorMessage.Root> : null}
      </Stack.Root>
    );
  }

  return (
    <Stack.Root direction="row" gap="condensed" align="center">
      <Text.Root id={nameId}>{name}</Text.Root>
      <Button.Root {...edit.getTriggerProps()} variant="ghost" aria-label="Rename" aria-describedby={nameId}>
        <Button.Icon>
          <Pencil />
        </Button.Icon>
      </Button.Root>
    </Stack.Root>
  );
}
