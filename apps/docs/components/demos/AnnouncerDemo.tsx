'use client';

import { Button, Stack, Text, useAnnouncer } from '@omsoo/todae';
import { useState } from 'react';

export function AnnounceSave() {
  const announce = useAnnouncer();
  const [count, setCount] = useState(0);
  return (
    <Stack.Root>
      <Button.Root
        onClick={() => {
          setCount((n) => n + 1);
          announce('Draft saved');
        }}
      >
        Save draft
      </Button.Root>
      <Text.Root>Announced “Draft saved” {count} {count === 1 ? 'time' : 'times'}.</Text.Root>
    </Stack.Root>
  );
}
