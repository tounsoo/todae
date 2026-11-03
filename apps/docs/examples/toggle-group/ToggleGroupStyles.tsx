'use client';

import { ToggleGroup } from '@tounsoo/todae';

export default function ToggleGroupStyles() {
  return (
    <ToggleGroup.Root aria-label="Text style" selectionMode="multiple" defaultValue={['bold']}>
      <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
      <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      <ToggleGroup.Item value="underline">Underline</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
