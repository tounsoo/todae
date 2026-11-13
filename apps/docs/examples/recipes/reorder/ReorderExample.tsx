'use client';

import {
  Button,
  Menu,
  Stack,
  Text,
  useAnnouncer,
  useReorder,
  type ReorderDropPosition,
  type UseReorderHandleProps,
  type UseReorderItemProps,
} from '@tounsoo/todae';
import { EllipsisVertical, GripVertical } from 'lucide-react';
import { memo, useCallback, useId, useState } from 'react';

type Channel = { id: string; name: string };

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

// The grip spans the row's height, with padding beside the icon, so it is easy to hit: at least
// 24 by 24 CSS pixels (WCAG 2.2 SC 2.5.8).
const gripStyle = {
  display: 'flex',
  alignItems: 'center',
  alignSelf: 'stretch',
  paddingInline: 'var(--todae-space-control-x)',
  cursor: 'grab',
  touchAction: 'none',
  color: 'var(--todae-color-fg-muted)',
} as const;

// A line at the edge the dragged row would land on.
function dropLine(drop: ReorderDropPosition | undefined) {
  if (drop === undefined) return undefined;
  const width = 'var(--todae-focus-ring-width)';
  const offset = drop === 'before' ? width : `calc(-1 * ${width})`;
  return `inset 0 ${offset} 0 var(--todae-color-accent-default)`;
}

type ChannelRowProps = UseReorderItemProps & {
  channel: Channel;
  index: number;
  last: number;
  grip: UseReorderHandleProps;
  move: (from: number, to: number) => void;
};

// A row takes its item props spread, so it renders again only when its own
// drag state changes, not on every step of a drag in another row.
const ChannelRow = memo(function ChannelRow({ channel, index, last, grip, move, ...item }: ChannelRowProps) {
  const moves = [
    ['Move to top', 0],
    ['Move up', index - 1],
    ['Move down', index + 1],
    ['Move to bottom', last],
  ] as const;
  return (
    <li
      {...item}
      style={{
        boxShadow: dropLine(item['data-drop']),
        background: item['data-dragging'] === undefined ? undefined : 'var(--todae-color-bg-subtle)',
      }}
    >
      <Stack.Root direction="row" align="center" gap="condensed">
        <span {...grip} aria-hidden style={gripStyle}>
          <GripVertical size="1em" />
        </span>
        <Text.Root style={{ flex: 1 }}>{channel.name}</Text.Root>
        <Menu.Root>
          <Menu.Trigger variant="ghost" aria-label={`Move ${channel.name}`}>
            <Button.Icon>
              <EllipsisVertical />
            </Button.Icon>
          </Menu.Trigger>
          <Menu.Content>
            {moves.map(([label, to]) => (
              <Menu.Item key={label} disabled={to === index || to < 0 || to > last} onSelect={() => move(index, to)}>
                {label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>
      </Stack.Root>
    </li>
  );
});

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

  // The same function until the channels change, so a drag step leaves the
  // rows' props as they were.
  const move = useCallback(
    (from: number, to: number) => {
      onReorder(moveItem(channels, from, to));
      announce(`${channels[from]!.name} moved to position ${to + 1} of ${channels.length}`);
    },
    [channels, onReorder, announce],
  );
  const reorder = useReorder({ onMove: move });

  return (
    <>
      <Text.Root id={labelId} variant="label">
        Pinned channels
      </Text.Root>
      <Stack.Root as="ol" gap="none" aria-labelledby={labelId}>
        {channels.map((channel, index) => (
          <ChannelRow
            key={channel.id}
            {...reorder.getItemProps(index)}
            channel={channel}
            index={index}
            last={last}
            grip={reorder.getHandleProps(index)}
            move={move}
          />
        ))}
      </Stack.Root>
    </>
  );
}

const CHANNELS: Channel[] = [
  { id: 'design', name: 'Design' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'support', name: 'Support' },
];

export default function ReorderExample() {
  const [channels, setChannels] = useState(CHANNELS);
  return (
    <Stack.Root gap="condensed" style={{ inlineSize: '100%', maxInlineSize: '20rem' }}>
      <PinnedChannels channels={channels} onReorder={setChannels} />
    </Stack.Root>
  );
}
