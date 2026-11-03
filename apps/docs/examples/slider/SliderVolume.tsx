'use client';

import { Field, Label, Slider, Stack, Text } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function SliderVolume() {
  const id = useId();
  const [value, setValue] = useState(40);
  return (
    <Stack.Root>
      <Field.Group>
        <Label.Root htmlFor={id}>Volume</Label.Root>
        <Slider.Root
          id={id}
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
        />
      </Field.Group>
      <Text.Root>{value}%</Text.Root>
    </Stack.Root>
  );
}
