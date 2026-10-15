'use client';

import { Chip, Stack } from '@tounsoo/todae';
import { X } from 'lucide-react';

export function ChipExamples() {
  return (
    <Stack.Root as="ul" direction="row" wrap align="center" aria-label="Chip examples">
      <li>
        <Chip.Root>Default</Chip.Root>
      </li>
      <li>
        <Chip.Root onRemove={() => undefined}>Removable</Chip.Root>
      </li>
      <li>
        <Chip.Root onRemove={() => undefined} removeIcon={<X strokeWidth={3} />}>
          Own icon
        </Chip.Root>
      </li>
      <li>
        <Chip.Root disabled onRemove={() => undefined}>
          Disabled
        </Chip.Root>
      </li>
      <li>
        <Chip.Root tone="success">Paid</Chip.Root>
      </li>
      <li>
        <Chip.Root tone="category-3" onRemove={() => undefined}>
          Design
        </Chip.Root>
      </li>
      <li>
        <Chip.Overflow overflowCount={4} />
      </li>
    </Stack.Root>
  );
}
