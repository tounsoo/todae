'use client';

import { Button, Menu, Stack, Text } from '@tounsoo/todae';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

const FILES = ['Q3 report.pdf', 'Roadmap.key', 'Budget.xlsx'];

export default function MenuContext() {
  const [last, setLast] = useState('nothing yet');
  return (
    <Stack.Root>
      <Stack.Root as="ul" gap="condensed">
        {FILES.map((file) => (
          <Menu.Root key={file}>
            <Menu.ContextTrigger
              render={(props) => (
                <li {...props}>
                  <Stack.Root direction="row" align="center" justify="between">
                    <Text.Root>{file}</Text.Root>
                    <Menu.Trigger variant="ghost" aria-label={`Actions for ${file}`}>
                      <Button.Icon>
                        <Ellipsis />
                      </Button.Icon>
                    </Menu.Trigger>
                  </Stack.Root>
                  <Menu.Content>
                    <Menu.Item onSelect={() => setLast(`Open ${file}`)}>Open</Menu.Item>
                    <Menu.Item onSelect={() => setLast(`Rename ${file}`)}>Rename</Menu.Item>
                    <Menu.Separator />
                    <Menu.Item onSelect={() => setLast(`Delete ${file}`)}>Delete</Menu.Item>
                  </Menu.Content>
                </li>
              )}
            />
          </Menu.Root>
        ))}
      </Stack.Root>
      <Text.Root tone="muted">
        Last action: {last}
      </Text.Root>
    </Stack.Root>
  );
}
