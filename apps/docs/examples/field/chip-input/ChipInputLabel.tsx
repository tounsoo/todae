'use client';

import { Field, Label, useChipField } from '@tounsoo/todae';
import { useId } from 'react';

export default function ChipInputLabel() {
  const tagsId = useId();
  const invalidId = useId();
  const field = useChipField({ initialChips: ['alpha'] });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={tagsId}>Tags</Label.Root>
        <Field.Root id={tagsId}>
          <Field.ChipInput {...field.getChipInputProps()} placeholder="Type and press Enter" />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={invalidId}>Tags</Label.Root>
        <Field.Root id={invalidId} invalid>
          <Field.ChipInput
            chips={['bad']}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => undefined}
          />
        </Field.Root>
      </Field.Group>
    </>
  );
}
