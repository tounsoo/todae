'use client';

import { Code, ColorPicker, Stack } from '@tounsoo/todae';
import { useState } from 'react';

export function ColorPickerInline() {
  const [color, setColor] = useState('#3366ff');
  return (
    <Stack.Root gap="condensed">
      <ColorPicker.Root aria-label="Accent" value={color} onValueChange={setColor}>
        <ColorPicker.Area />
        <ColorPicker.Hue />
      </ColorPicker.Root>
      <Code.Root>{color}</Code.Root>
    </Stack.Root>
  );
}
