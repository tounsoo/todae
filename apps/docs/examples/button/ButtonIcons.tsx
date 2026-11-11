'use client';

import { Button } from '@tounsoo/todae';
import { ArrowRight, Plus } from 'lucide-react';

export default function ButtonIcons() {
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
