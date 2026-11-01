'use client';

import { Button, Stack, Text, useHotkey } from '@tounsoo/todae';
import { useState } from 'react';

export function SearchShortcut() {
  const [open, setOpen] = useState(false);
  const keys = ['Alt+T'];
  useHotkey(keys, () => setOpen(true));
  return (
    <Stack.Root gap="condensed" align="start">
      <Button.Root aria-keyshortcuts={keys.join(' ')} onClick={() => setOpen(true)}>
        Search
      </Button.Root>
      <Text.Root>{open ? 'Search is open' : 'Press Alt+T'}</Text.Root>
    </Stack.Root>
  );
}
