'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldNumberPrice() {
  const id = useId();
  const [price, setPrice] = useState<number | null>(12000);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Price</Label.Root>
      <Field.Root id={id} name="price">
        <Field.Affix>₩</Field.Affix>
        <Field.NumberInput
          value={price}
          onValueChange={setPrice}
          min={0}
          step={100}
          locale="ko"
          formatOptions={{ maximumFractionDigits: 0 }}
        />
      </Field.Root>
    </Field.Group>
  );
}
