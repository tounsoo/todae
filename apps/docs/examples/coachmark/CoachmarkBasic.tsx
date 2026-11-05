'use client';

import { Button, Coachmark, Stack } from '@tounsoo/todae';
import { useRef, useState } from 'react';

export default function CoachmarkBasic() {
  const exportRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [exported, setExported] = useState(0);
  return (
    <Stack.Root direction="row" gap="condensed" wrap>
      <Button.Root onClick={() => setOpen(true)}>Show the tip</Button.Root>
      <Button.Root ref={exportRef} variant="secondary" onClick={() => setExported(exported + 1)}>
        {exported ? `Exported ${exported}×` : 'Export'}
      </Button.Root>
      <Coachmark.Root targetRef={exportRef} open={open} onOpenChange={setOpen}>
        <Coachmark.Title>Export moved here</Coachmark.Title>
        <Coachmark.Description>Save this report as a PDF or a CSV file. The button works while the tip is open, so try it.</Coachmark.Description>
        <Coachmark.Footer>
          <Coachmark.Close variant="primary">Got it</Coachmark.Close>
        </Coachmark.Footer>
      </Coachmark.Root>
    </Stack.Root>
  );
}
