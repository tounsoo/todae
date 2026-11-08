'use client';

import { Field, useChipField } from '@tounsoo/todae';

export default function ChipInputCommitKeys() {
  const field = useChipField({ initialChips: ['one'] });
  return (
    <Field.Root aria-label="Tags">
      <Field.ChipInput {...field.getChipInputProps()} commitKeys={['Enter', ',']} placeholder="Enter or comma" />
    </Field.Root>
  );
}
