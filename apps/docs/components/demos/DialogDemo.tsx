'use client';

import { Button, DensityProvider, Dialog, ThemeProvider } from '@omsoo.design/todae';
import { useState } from 'react';

export function DialogBasic() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button.Root onClick={() => setOpen(true)}>Open dialog</Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Header>
          <Dialog.Title>Discard draft?</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Header>
        <Dialog.Description>This cannot be undone.</Dialog.Description>
        <Dialog.Body>The dialog stays centered on every viewport. It does not become a sheet.</Dialog.Body>
        <Dialog.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Keep
          </Button.Root>
          <Button.Root onClick={() => setOpen(false)}>Discard</Button.Root>
        </Dialog.Footer>
      </Dialog.Root>
    </>
  );
}

export function DialogThemed() {
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
