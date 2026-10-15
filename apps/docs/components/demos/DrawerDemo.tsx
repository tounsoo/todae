'use client';

import { Button, Dialog, Drawer, type DrawerSide } from '@tounsoo/todae';
import { useState } from 'react';

export function DrawerBasic({ side }: { side?: DrawerSide }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button.Root variant="secondary" onClick={() => setOpen(true)}>
        {side === 'start' ? 'Open at start' : 'Open at end'}
      </Button.Root>
      <Drawer.Root open={open} onOpenChange={setOpen} side={side}>
        <Dialog.Header>
          <Dialog.Title>Filters</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Header>
        <Dialog.Body>The panel fills the height of the viewport and scrolls on its own.</Dialog.Body>
        <Dialog.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Reset
          </Button.Root>
          <Button.Root onClick={() => setOpen(false)}>Apply</Button.Root>
        </Dialog.Footer>
      </Drawer.Root>
    </>
  );
}
