'use client';

import { Button, DensityProvider, Dialog, ThemeProvider } from '@tounsoo/todae';
import { useState } from 'react';

export default function DialogThemed() {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider appearance="dark">
      <DensityProvider density="compact">
        <Button.Root onClick={() => setOpen(true)}>Dark compact</Button.Root>
        <Dialog.Root open={open} onOpenChange={setOpen} dismissOnBackdrop={false}>
          <Dialog.Title>Pinned scrim</Dialog.Title>
          <Dialog.Description>Backdrop clicks do nothing. Escape still closes.</Dialog.Description>
          <Dialog.Footer>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Footer>
        </Dialog.Root>
      </DensityProvider>
    </ThemeProvider>
  );
}
