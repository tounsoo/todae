'use client';

import { Kbd, Menu, Stack, Text } from '@tounsoo/todae';
import { FilePlus, Save } from 'lucide-react';
import { useState } from 'react';

export default function MenuCommands() {
  const [last, setLast] = useState('nothing yet');
  return (
    <Stack.Root>
      <Menu.Root>
        <Menu.Trigger variant="secondary">File</Menu.Trigger>
        <Menu.Content>
          <Menu.Item aria-keyshortcuts="Meta+N" onSelect={() => setLast('New')}>
            <Menu.ItemIcon>
              <FilePlus />
            </Menu.ItemIcon>
            New
            <Menu.ItemShortcut>
              <Kbd.Root>
                <Kbd.Root>⌘</Kbd.Root>+<Kbd.Root>N</Kbd.Root>
              </Kbd.Root>
            </Menu.ItemShortcut>
          </Menu.Item>
          <Menu.Item aria-keyshortcuts="Meta+S" onSelect={() => setLast('Save')}>
            <Menu.ItemIcon>
              <Save />
            </Menu.ItemIcon>
            Save
            <Menu.ItemShortcut>
              <Kbd.Root>
                <Kbd.Root>⌘</Kbd.Root>+<Kbd.Root>S</Kbd.Root>
              </Kbd.Root>
            </Menu.ItemShortcut>
          </Menu.Item>
          <Menu.Item onSelect={() => setLast('Close')}>Close</Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <Text.Root tone="muted">Last action: {last}</Text.Root>
    </Stack.Root>
  );
}
