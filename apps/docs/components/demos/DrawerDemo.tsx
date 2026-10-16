'use client';

import { Button, Drawer, type DrawerSide } from '@tounsoo/todae';
import { useState } from 'react';

export function DrawerBasic({ side }: { side?: DrawerSide }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button.Root variant="secondary" onClick={() => setOpen(true)}>
        {side === 'start' ? 'Open at start' : 'Open at end'}
      </Button.Root>
      <Drawer.Root open={open} onOpenChange={setOpen} side={side}>
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close />
        </Drawer.Header>
        <Drawer.Body>The body fills the height the header and footer leave, and scrolls on its own.</Drawer.Body>
        <Drawer.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Reset
          </Button.Root>
          <Button.Root onClick={() => setOpen(false)}>Apply</Button.Root>
        </Drawer.Footer>
      </Drawer.Root>
    </>
  );
}
