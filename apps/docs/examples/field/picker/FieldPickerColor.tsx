'use client';

import { ColorPicker, Field, Label, normalizeHex } from '@tounsoo/todae';
import { useId, useState } from 'react';

// The color is the value. The text shows it, or what is being typed until it leaves the field.
export default function FieldPickerColor() {
  const id = useId();
  const [color, setColor] = useState('#3366ff');
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Accent</Label.Root>
      <Field.Root id={id} name="accent">
        <Field.Picker swatch={color}>
          <ColorPicker.Root
            aria-label="Accent"
            value={color}
            onValueChange={(next) => {
              setColor(next);
              setTyped(null);
            }}
          >
            <ColorPicker.Area />
            <ColorPicker.Hue />
          </ColorPicker.Root>
        </Field.Picker>
        <Field.TextInput
          value={typed ?? color}
          onValueChange={(next) => {
            setTyped(next);
            const hex = normalizeHex(next);
            if (hex) setColor(hex);
          }}
          onBlur={() => setTyped(null)}
          spellCheck={false}
        />
      </Field.Root>
    </Field.Group>
  );
}
