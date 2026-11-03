'use client';

import { Button, Popover, Stack, usePopover } from '@tounsoo/todae';
import { useState } from 'react';

export default function PopoverVeto() {
  const [open, setOpen] = useState(false);
  const popover = usePopover({
    open,
    onOpenChange: (next, reason) => {
      if (reason === 'outside') return;
      setOpen(next);
    },
  });
  return (
    <>
      <Button.Root tooltip={false} {...popover.getTriggerProps()}>
        Outside is vetoed
      </Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Pinned">
        <Stack.Root>
          Outside click calls onOpenChange but this stays open. Escape still closes.
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button.Root>
        </Stack.Root>
      </Popover.Root>
    </>
  );
}
