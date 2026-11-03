'use client';

import { Button, Dialog } from '@tounsoo/todae';
import { useState } from 'react';

export default function DialogBasic() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button.Root onClick={() => setOpen(true)}>Open dialog</Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Header>
          <Dialog.Title>Invite teammates</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Description>They get an email with a link to this project.</Dialog.Description>
        <Dialog.Body>The dialog stays centered on every viewport. It does not become a sheet.</Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close>Cancel</Dialog.Close>
          <Button.Root onClick={() => setOpen(false)}>Send invites</Button.Root>
        </Dialog.Footer>
      </Dialog.Root>
    </>
  );
}
