'use client';

import { Button, OptionList, Popover, Stack, usePopover } from '@tounsoo/todae';
import { useState } from 'react';

export default function PopoverMenu() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [under, setUnder] = useState(0);
  const popover = usePopover({ open, onOpenChange: setOpen, haspopup: 'listbox' });
  return (
    <Stack.Root>
      <Button.Root tooltip={false} {...popover.getTriggerProps()}>
        {value ? `Fruit: ${value}` : 'Choose fruit'}
      </Button.Root>
      <Popover.Root {...popover.getPopoverProps()}>
        <OptionList.Root
          aria-label="Fruit"
          value={value}
          onValueChange={(next) => {
            setValue(next);
            setOpen(false);
          }}
        >
          <OptionList.Option value="apple">Apple</OptionList.Option>
          <OptionList.Option value="pear">Pear</OptionList.Option>
          <OptionList.Option value="plum">Plum</OptionList.Option>
        </OptionList.Root>
      </Popover.Root>
      <Button.Root variant="secondary" onClick={() => setUnder((count) => count + 1)}>
        Page under {under}
      </Button.Root>
    </Stack.Root>
  );
}
