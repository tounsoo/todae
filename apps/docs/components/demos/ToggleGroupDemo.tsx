'use client';

import { Button, ToggleGroup } from '@omsoo/todae';
import { useState } from 'react';

export function ButtonToggle() {
  const [muted, setMuted] = useState(false);
  return (
    <Button.Root variant="secondary" pressed={muted} onPressedChange={setMuted}>
      Mute
    </Button.Root>
  );
}

export function ToggleGroupAlign() {
  const [align, setAlign] = useState<string | null>('left');
  return (
    <ToggleGroup.Root aria-label="Alignment" value={align} onValueChange={setAlign}>
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}

export function ToggleGroupStyles() {
  return (
    <ToggleGroup.Root aria-label="Text style" selectionMode="multiple" defaultValue={['bold']}>
      <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
      <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      <ToggleGroup.Item value="underline">Underline</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
