'use client';

import { Button, Stack, Text, useAnnouncer } from '@tounsoo/todae';
import { useState } from 'react';

export function AnnounceSave() {
  const announce = useAnnouncer();
  const [count, setCount] = useState(0);
  return (
    <Stack>
      <Button.Root
        onClick={() => {
          setCount((n) => n + 1);
          announce('Draft saved');
        }}
      >
        Save draft
      </Button.Root>
      <Text>Announced “Draft saved” {count} {count === 1 ? 'time' : 'times'}.</Text>
    </Stack>
  );
}
