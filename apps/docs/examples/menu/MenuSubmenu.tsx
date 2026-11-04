'use client';

import { Menu, Stack, Text } from '@tounsoo/todae';
import { useState } from 'react';

export default function MenuSubmenu() {
  const [last, setLast] = useState('nothing yet');
  return (
    <Stack.Root>
      <Menu.Root>
        <Menu.Trigger variant="secondary">File</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={() => setLast('Rename')}>Rename</Menu.Item>
          <Menu.Submenu>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.SubmenuContent>
              <Menu.Item onSelect={() => setLast('Copy link')}>Copy link</Menu.Item>
              <Menu.Item onSelect={() => setLast('Email')}>Email</Menu.Item>
              <Menu.Submenu>
                <Menu.SubmenuTrigger>Export as</Menu.SubmenuTrigger>
                <Menu.SubmenuContent>
                  <Menu.Item onSelect={() => setLast('Export as PDF')}>PDF</Menu.Item>
                  <Menu.Item onSelect={() => setLast('Export as PNG')}>PNG</Menu.Item>
                </Menu.SubmenuContent>
              </Menu.Submenu>
            </Menu.SubmenuContent>
          </Menu.Submenu>
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
