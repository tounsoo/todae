'use client';

import { Button, Option, OptionList, Popover } from '@tounsoo/todae';
import { useState } from 'react';

export function PopoverMenu() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger>{value ?? 'Choose fruit'}</Popover.Trigger>
      <Popover.Content aria-label="Fruit">
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
      </Popover.Content>
    </Popover>
  );
}

export function PopoverVeto() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(next, reason) => {
        if (reason === 'outside') return;
        setOpen(next);
      }}
    >
      <Popover.Trigger>Outside is vetoed</Popover.Trigger>
      <Popover.Content aria-label="Pinned">
        Outside click calls onOpenChange but this stays open. Escape still closes.
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Popover.Content>
    </Popover>
  );
}
