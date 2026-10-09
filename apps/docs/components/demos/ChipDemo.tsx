'use client';

import { Chip } from '@omsoo/todae';

// Stands in for an icon from your own set.
function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChipExamples() {
  return (
    <>
      <Chip.Root>Default</Chip.Root>
      <Chip.Root onRemove={() => undefined}>Removable</Chip.Root>
      <Chip.Root onRemove={() => undefined} removeIcon={<CloseIcon />}>
        Own icon
      </Chip.Root>
      <Chip.Root disabled onRemove={() => undefined}>
        Disabled
      </Chip.Root>
      <Chip.Overflow overflowCount={4} />
    </>
  );
}
