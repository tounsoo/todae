'use client';

import { Button, Menu, Stack, Text, useAnnouncer } from '@tounsoo/todae';
import { GripVertical } from 'lucide-react';
import { useId, useState } from 'react';

type Channel = { id: string; name: string };

const CHANNELS: Channel[] = [
  { id: 'design', name: 'Design' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'support', name: 'Support' },
];

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function ReorderExample() {
  const [channels, setChannels] = useState(CHANNELS);
  const announce = useAnnouncer();
  const labelId = useId();

  const move = (from: number, to: number) => {
    const channel = channels[from]!;
    setChannels(moveItem(channels, from, to));
    announce(`${channel.name} moved to position ${to + 1} of ${channels.length}`);
  };

  const last = channels.length - 1;

  return (
    <Stack.Root gap="condensed" style={{ inlineSize: '100%', maxInlineSize: '20rem' }}>
      <Text.Root id={labelId} size="label">
        Pinned channels
      </Text.Root>
      <Stack.Root as="ol" gap="none" aria-labelledby={labelId}>
        {channels.map((channel, index) => (
          <li key={channel.id}>
            <Stack.Root direction="row" align="center" justify="between">
              <Text.Root>{channel.name}</Text.Root>
              <Menu.Root>
                <Menu.Trigger variant="ghost" aria-label={`Move ${channel.name}`}>
                  <Button.Icon>
                    <GripVertical />
                  </Button.Icon>
                </Menu.Trigger>
                <Menu.Content>
                  <Menu.Item disabled={index === 0} onSelect={() => move(index, 0)}>
                    Move to top
                  </Menu.Item>
                  <Menu.Item disabled={index === 0} onSelect={() => move(index, index - 1)}>
                    Move up
                  </Menu.Item>
                  <Menu.Item disabled={index === last} onSelect={() => move(index, index + 1)}>
                    Move down
                  </Menu.Item>
                  <Menu.Item disabled={index === last} onSelect={() => move(index, last)}>
                    Move to bottom
                  </Menu.Item>
                </Menu.Content>
              </Menu.Root>
            </Stack.Root>
          </li>
        ))}
      </Stack.Root>
    </Stack.Root>
  );
}
