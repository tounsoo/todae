'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldNumberStepper({ locale }: { locale: string }) {
  const id = useId();
  const [quantity, setQuantity] = useState<number | null>(2);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Quantity</Label.Root>
      <Field.Root id={id} name="quantity">
        <Field.Decrement />
        <Field.NumberInput value={quantity} onValueChange={setQuantity} min={1} max={99} locale={locale} />
        <Field.Increment />
      </Field.Root>
    </Field.Group>
  );
}
