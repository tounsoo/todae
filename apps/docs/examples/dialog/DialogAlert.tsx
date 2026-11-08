'use client';

import { Button, Dialog } from '@tounsoo/todae';
import { useRef, useState } from 'react';

export default function DialogAlert() {
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
