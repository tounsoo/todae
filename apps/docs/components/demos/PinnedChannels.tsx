'use client';

import { Button, Menu, Stack, Text, useAnnouncer } from '@tounsoo/todae';
import { EllipsisVertical } from 'lucide-react';
import { useId } from 'react';

export type Channel = { id: string; name: string };

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function PinnedChannels({
  channels,
  onReorder,
}: {
  channels: readonly Channel[];
  onReorder: (channels: Channel[]) => void;
}) {
  const announce = useAnnouncer();
  const labelId = useId();
  const last = channels.length - 1;

  const move = (from: number, to: number) => {
    onReorder(moveItem(channels, from, to));
    announce(`${channels[from]!.name} moved to position ${to + 1} of ${channels.length}`);
  };

  return (
    <>
      <Text.Root id={labelId} size="label">
        Pinned channels
      </Text.Root>
      <Stack.Root as="ol" gap="none" aria-labelledby={labelId}>
        {channels.map((channel, index) => {
          const moves = [
            ['Move to top', 0],
            ['Move up', index - 1],
            ['Move down', index + 1],
            ['Move to bottom', last],
          ] as const;
          return (
            <li key={channel.id}>
              <Stack.Root direction="row" align="center" justify="between">
                <Text.Root>{channel.name}</Text.Root>
                <Menu.Root>
                  <Menu.Trigger variant="ghost" aria-label={`Move ${channel.name}`}>
                    <Button.Icon>
                      <EllipsisVertical />
                    </Button.Icon>
                  </Menu.Trigger>
                  <Menu.Content>
                    {moves.map(([label, to]) => (
                      <Menu.Item
                        key={label}
                        disabled={to === index || to < 0 || to > last}
                        onSelect={() => move(index, to)}
                      >
                        {label}
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Root>
              </Stack.Root>
            </li>
          );
        })}
      </Stack.Root>
    </>
  );
}
