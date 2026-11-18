'use client';

import { Slider, Stack, Text } from '@tounsoo/todae';
import { useState } from 'react';

export default function SliderRange() {
  const [value, setValue] = useState<[number, number]>([20, 80]);
  return (
    <Stack.Root>
      <Slider.Root
        mode="range"
        min={0}
        max={100}
        startLabel="Minimum"
        endLabel="Maximum"
        value={value}
        onValueChange={setValue}
      />
      <Text.Root>
        {value[0]} to {value[1]}
      </Text.Root>
    </Stack.Root>
  );
}
