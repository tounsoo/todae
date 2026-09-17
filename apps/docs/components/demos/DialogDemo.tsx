'use client';

import { Button, DensityProvider, Dialog, ThemeProvider } from '@tounsoo/todae';
import { useState } from 'react';

export function DialogBasic() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Header>
          <Dialog.Title>Discard draft?</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Header>
        <Dialog.Description>This cannot be undone.</Dialog.Description>
        <Dialog.Body>The dialog stays centered on every viewport. It does not become a sheet.</Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep
          </Button>
          <Button onClick={() => setOpen(false)}>Discard</Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}

export function DialogThemed() {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider appearance="dark">
      <DensityProvider density="compact">
        <Button onClick={() => setOpen(true)}>Dark compact</Button>
        <Dialog open={open} onOpenChange={setOpen} dismissOnBackdrop={false}>
          <Dialog.Title>Pinned scrim</Dialog.Title>
          <Dialog.Description>Backdrop clicks do nothing. Escape still closes.</Dialog.Description>
          <Dialog.Footer>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Footer>
        </Dialog>
      </DensityProvider>
    </ThemeProvider>
  );
}
