'use client';

import { Button } from '@omsoo/todae';

export function ButtonVariants() {
  return (
    <>
      <Button.Root>Save</Button.Root>
      <Button.Root variant="secondary">Cancel</Button.Root>
      <Button.Root variant="ghost">Ghost</Button.Root>
      <Button.Root disabled>Disabled</Button.Root>
    </>
  );
}

export function ButtonOverflow() {
  return (
    <div style={{ width: 96 }}>
      <Button.Root>Very long archive label</Button.Root>
    </div>
  );
}

export function ButtonIcons() {
  return (
    <>
      <Button.Root>
        <Button.Icon>
          <span>+</span>
        </Button.Icon>
        Save
      </Button.Root>
      <Button.Root variant="secondary">
        Next
        <Button.Icon>
          <span>→</span>
        </Button.Icon>
      </Button.Root>
      <Button.Root aria-label="Add">
        <Button.Icon>
          <span>+</span>
        </Button.Icon>
      </Button.Root>
    </>
  );
}

export function ButtonGroupAlign() {
  return (
    <Button.Group aria-label="Align">
      <Button.Root variant="secondary" aria-label="Left">
        <Button.Icon>
          <span>L</span>
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label="Center">
        <Button.Icon>
          <span>C</span>
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label="Right">
        <Button.Icon>
          <span>R</span>
        </Button.Icon>
      </Button.Root>
    </Button.Group>
  );
}
