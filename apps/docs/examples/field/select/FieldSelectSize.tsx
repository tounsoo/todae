'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldSelectSize() {
  const id = useId();
  const [size, setSize] = useState('m');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Size</Label.Root>
      <Field.Root id={id}>
        <Field.Select value={size} onChange={(event) => setSize(event.target.value)}>
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
          <option value="xl" disabled>
            Extra large (sold out)
          </option>
        </Field.Select>
      </Field.Root>
    </Field.Group>
  );
}
