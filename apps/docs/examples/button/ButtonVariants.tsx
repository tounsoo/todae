'use client';

import { Button } from '@tounsoo/todae';

export default function ButtonVariants() {
  return (
    <>
      <Button.Root>Save</Button.Root>
      <Button.Root variant="secondary">Cancel</Button.Root>
      <Button.Root variant="ghost">Ghost</Button.Root>
      <Button.Root disabled>Disabled</Button.Root>
    </>
  );
}
