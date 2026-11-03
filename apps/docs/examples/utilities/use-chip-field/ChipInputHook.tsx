'use client';

import { Field, useChipField } from '@tounsoo/todae';

export default function ChipInputHook() {
  const field = useChipField({ initialChips: ['react'] });
  return (
    <Field.Root aria-label="Tags">
      <Field.ChipInput {...field.getChipInputProps()} placeholder="Add a tag" />
    </Field.Root>
  );
}
