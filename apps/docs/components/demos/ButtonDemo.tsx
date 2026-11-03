'use client';

import { Button } from '@tounsoo/todae';
import { ArrowRight, Plus } from 'lucide-react';

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
          <Plus />
        </Button.Icon>
        Save
      </Button.Root>
      <Button.Root variant="secondary">
        Next
        <Button.Icon>
          <ArrowRight />
        </Button.Icon>
      </Button.Root>
      <Button.Root aria-label="Add">
        <Button.Icon>
          <Plus />
        </Button.Icon>
      </Button.Root>
    </>
  );
}

/** Links drawn as buttons through render. The one without href looks disabled. */
export function ButtonLinks() {
  return (
    <>
      <Button.Root render={(props) => <a {...props} href="https://www.npmjs.com/package/@tounsoo/todae" />}>
        Install
        <Button.Icon>
          <ArrowRight />
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" render={(props) => <a {...props} href="https://github.com/tounsoo/todae" />}>
        Source
      </Button.Root>
      <Button.Root variant="secondary" render={(props) => <a {...props} />}>
        Not yet available
      </Button.Root>
    </>
  );
}
