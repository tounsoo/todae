'use client';

import { Chip } from '@tounsoo/todae';

export function ChipExamples() {
  return (
    <>
      <Chip.Root>Default</Chip.Root>
      <Chip.Root onRemove={() => undefined}>Dismissible</Chip.Root>
      <Chip.Root disabled onRemove={() => undefined}>
        Disabled
      </Chip.Root>
      <Chip.Overflow overflowCount={4} />
    </>
  );
}
