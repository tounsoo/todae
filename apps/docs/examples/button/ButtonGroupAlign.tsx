'use client';

import { Button } from '@tounsoo/todae';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';

export default function ButtonGroupAlign() {
  return (
    <Button.Group aria-label="Align">
      <Button.Root variant="secondary" aria-label="Left">
        <Button.Icon>
          <AlignLeft />
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label="Center">
        <Button.Icon>
          <AlignCenter />
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label="Right">
        <Button.Icon>
          <AlignRight />
        </Button.Icon>
      </Button.Root>
    </Button.Group>
  );
}
