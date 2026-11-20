'use client';

import { ToggleGroup } from '@tounsoo/todae';
import { useState } from 'react';

export default function ToggleGroupRequired() {
  const [align, setAlign] = useState('left');
  return (
    <ToggleGroup.Root
      aria-label="Alignment"
      required
      value={align}
      onValueChange={(next) => {
        if (next !== null) setAlign(next);
      }}
    >
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
