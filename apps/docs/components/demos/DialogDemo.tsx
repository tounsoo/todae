'use client';

import { Button, DensityProvider, Dialog, ThemeProvider } from '@tounsoo/todae';
import { useRef, useState } from 'react';

export function DialogBasic() {
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button.Root onClick={() => setOpen(true)}>Open dialog</Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen} initialFocusRef={keepRef}>
        <Dialog.Header>
          <Dialog.Title>Discard draft?</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Description>This cannot be undone.</Dialog.Description>
        <Dialog.Body>The dialog stays centered on every viewport. It does not become a sheet.</Dialog.Body>
        <Dialog.Footer>
          <Button.Root ref={keepRef} variant="secondary" onClick={() => setOpen(false)}>
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

export function DialogAlert() {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const restoreRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {deleted ? (
        <Button.Root ref={restoreRef} variant="secondary" onClick={() => setDeleted(false)}>
          Restore report.pdf
        </Button.Root>
      ) : (
        <Button.Root onClick={() => setOpen(true)}>Delete report.pdf</Button.Root>
      )}
      <Dialog.Root role="alertdialog" open={open} onOpenChange={setOpen} restoreFocusRef={restoreRef}>
        <Dialog.Title>Delete report.pdf?</Dialog.Title>
        <Dialog.Description>The file is removed for everyone in this project.</Dialog.Description>
        <Dialog.Footer>
          <Dialog.Close>Cancel</Dialog.Close>
          <Button.Root
            onClick={() => {
              setDeleted(true);
              setOpen(false);
            }}
          >
            Delete
          </Button.Root>
        </Dialog.Footer>
      </Dialog.Root>
    </>
  );
}
