'use client';

import { Menu, Stack, Text } from '@tounsoo/todae';
import { useState } from 'react';

export default function MenuActions() {
  const [last, setLast] = useState('nothing yet');
  return (
    <Stack.Root>
      <Menu.Root>
        <Menu.Trigger variant="secondary">Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={() => setLast('Rename')}>Rename</Menu.Item>
          <Menu.Item onSelect={() => setLast('Duplicate')}>Duplicate</Menu.Item>
          <Menu.Item disabled>Move to…</Menu.Item>
          <Menu.Separator />
          <Menu.Item onSelect={() => setLast('Delete')}>Delete</Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <Text.Root tone="muted">
        Last action: {last}
      </Text.Root>
    </Stack.Root>
  );
}
