'use client';

import { Chip, ChipOverflow } from '@tounsoo/todae';

export function ChipExamples() {
  return (
    <>
      <Chip>Default</Chip>
      <Chip onDismiss={() => undefined}>Dismissible</Chip>
      <Chip disabled onDismiss={() => undefined}>
        Disabled
      </Chip>
      <ChipOverflow overflowCount={4} />
    </>
  );
}
