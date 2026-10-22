'use client';

import { Button, Menu, Stack, Text } from '@tounsoo/todae';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

export function MenuActions() {
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
      <Text.Root size="s" tone="muted">
        Last action: {last}
      </Text.Root>
    </Stack.Root>
  );
}

export function MenuOptions() {
  const [grid, setGrid] = useState(true);
  const [rulers, setRulers] = useState(false);
  const [sort, setSort] = useState('name');
  return (
    <Menu.Root>
      <Menu.Trigger variant="secondary">View</Menu.Trigger>
      <Menu.Content>
        <Menu.Group aria-label="Show">
          <Menu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
            Grid
          </Menu.CheckboxItem>
          <Menu.CheckboxItem checked={rulers} onCheckedChange={setRulers}>
            Rulers
          </Menu.CheckboxItem>
        </Menu.Group>
        <Menu.Separator />
        <Menu.RadioGroup aria-label="Sort by" value={sort} onValueChange={setSort}>
          <Menu.RadioItem value="name">Name</Menu.RadioItem>
          <Menu.RadioItem value="modified">Date modified</Menu.RadioItem>
          <Menu.RadioItem value="size">Size</Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

const FILES = ['Q3 report.pdf', 'Roadmap.key', 'Budget.xlsx'];

export function MenuContext() {
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
      <Text.Root size="s" tone="muted">
        Last action: {last}
      </Text.Root>
    </Stack.Root>
  );
}
