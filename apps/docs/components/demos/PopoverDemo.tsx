'use client';

import { Button, Option, OptionList, Popover, Stack, usePopover } from '@tounsoo/todae';
import { useState } from 'react';

export function PopoverMenu() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [under, setUnder] = useState(0);
  const popover = usePopover({ open, onOpenChange: setOpen });
  return (
    <Stack>
      <Button.Root tooltip={false} {...popover.getTriggerProps()}>
        {value ?? 'Choose fruit'}
      </Button.Root>
      <Popover {...popover.getPopoverProps()} aria-label="Fruit">
        <OptionList
          value={value}
          onChange={(next) => {
            setValue(next);
            setOpen(false);
          }}
        >
          <Option value="apple">Apple</Option>
          <Option value="pear">Pear</Option>
          <Option value="plum">Plum</Option>
        </OptionList>
      </Popover>
      <Button.Root variant="secondary" onClick={() => setUnder((count) => count + 1)}>
        Page under {under}
      </Button.Root>
    </Stack>
  );
}

export function PopoverVeto() {
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
      <Popover {...popover.getPopoverProps()} aria-label="Pinned">
        <Stack>
          Outside click calls onOpenChange but this stays open. Escape still closes.
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button.Root>
        </Stack>
      </Popover>
    </>
  );
}
