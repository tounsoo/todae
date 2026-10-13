'use client';

import { Chip } from '@omsoo.design/todae';
import { X } from 'lucide-react';

export function ChipExamples() {
  return (
    <>
      <Chip.Root>Default</Chip.Root>
      <Chip.Root onRemove={() => undefined}>Removable</Chip.Root>
      <Chip.Root onRemove={() => undefined} removeIcon={<X strokeWidth={3} />}>
        Own icon
      </Chip.Root>
      <Chip.Root disabled onRemove={() => undefined}>
        Disabled
      </Chip.Root>
      <Chip.Root tone="success">Paid</Chip.Root>
      <Chip.Root tone="category-3" onRemove={() => undefined}>
        Design
      </Chip.Root>
      <Chip.Overflow overflowCount={4} />
    </>
  );
}
