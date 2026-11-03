'use client';

import { Field, Label, normalizeHex } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldColorAccent() {
  const id = useId();
  const [color, setColor] = useState('#3366ff');
  const [text, setText] = useState(color);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Accent</Label.Root>
      <Field.Root id={id}>
        <Field.ColorPicker
          value={color}
          onValueChange={(next) => {
            setColor(next);
            setText(next);
          }}
        />
        <Field.TextInput
          value={text}
          onChange={() => undefined}
          onValueChange={(next) => {
            setText(next);
            const hex = normalizeHex(next);
            if (hex) setColor(hex);
          }}
          onBlur={() => setText(color)}
          spellCheck={false}
        />
      </Field.Root>
    </Field.Group>
  );
}
