'use client';

import { BottomSheet, Button, Stack } from '@tounsoo/todae';
import { useState } from 'react';

const OPTIONS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

export function BottomSheetBasic() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<'mid' | 'full'>('mid');
  return (
    <>
      <Button.Root onClick={() => setOpen(true)}>Open sheet</Button.Root>
      <BottomSheet.Root open={open} onOpenChange={setOpen} snap={snap} onSnapChange={setSnap}>
        <BottomSheet.Header>
          <BottomSheet.Title>Share</BottomSheet.Title>
          <BottomSheet.Close />
        </BottomSheet.Header>
        <BottomSheet.Description>Drag the grabber. Mid and full snap.</BottomSheet.Description>
        <BottomSheet.Body>
          <Stack.Root as="ul" gap="condensed" aria-label="Share to">
            {OPTIONS.map((item) => (
              <li key={item}>
                <Button.Root variant="ghost" onClick={() => setOpen(false)}>
                  {item}
                </Button.Root>
              </li>
            ))}
          </Stack.Root>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button.Root>
        </BottomSheet.Footer>
      </BottomSheet.Root>
    </>
  );
}
