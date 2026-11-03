'use client';

import { ToggleGroup } from '@tounsoo/todae';
import { useState } from 'react';

export default function ToggleGroupAlign() {
  const [align, setAlign] = useState<string | null>('left');
  return (
    <ToggleGroup.Root aria-label="Alignment" value={align} onValueChange={setAlign}>
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
