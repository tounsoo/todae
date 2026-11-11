'use client';

import {
  Button,
  Menu,
  Stack,
  Text,
  useAnnouncer,
  useFocusHandoff,
  useReorder,
  useReorderGroup,
  type ReorderDrop,
  type ReorderGroup,
  type ReorderPlace,
  type UseReorderResult,
} from '@tounsoo/todae';
import { EllipsisVertical, GripVertical } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';

type Channel = { id: string; name: string };
type List = { id: string; name: string; channels: Channel[] };
type Move = (from: ReorderPlace<number>, to: ReorderPlace<number>) => void;

function moveChannel(lists: readonly List[], from: ReorderPlace<number>, to: ReorderPlace<number>): List[] {
  const next = lists.map((list) => ({ ...list, channels: [...list.channels] }));
  const [channel] = next[from.list]!.channels.splice(from.index, 1);
  next[to.list]!.channels.splice(to.index, 0, channel!);
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
function dropLine(drop: ReorderDrop | null, index: number) {
  if (drop?.index !== index) return undefined;
  const width = 'var(--todae-focus-ring-width)';
  const offset = drop.position === 'before' ? width : `calc(-1 * ${width})`;
  return `inset 0 ${offset} 0 var(--todae-color-accent-default)`;
}

function Row({
  channel,
  index,
  listIndex,
  lists,
  reorder,
  move,
  landing,
  landed,
}: {
  channel: Channel;
  index: number;
  listIndex: number;
  lists: readonly List[];
  reorder: UseReorderResult;
  move: Move;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
}) {
  // A row moved to the other list leaves this one while its menu holds focus. Focus goes on to
  // the row's trigger in its new list.
  const handoff = useFocusHandoff({ to: landing });
  const last = lists[listIndex]!.channels.length - 1;
  return (
    <li
      ref={handoff}
      {...reorder.getItemProps(index)}
      style={{
        boxShadow: dropLine(reorder.drop, index),
        background: reorder.dragging === index ? 'var(--todae-color-bg-subtle)' : undefined,
      }}
    >
      <Stack.Root direction="row" align="center" gap="condensed">
        <span {...reorder.getHandleProps(index)} aria-hidden style={gripStyle}>
          <GripVertical size="1em" />
        </span>
        <Text.Root style={{ flex: 1 }}>{channel.name}</Text.Root>
        <Menu.Root>
          <Menu.Trigger ref={channel.id === landed ? landing : undefined} variant="ghost" aria-label={`Move ${channel.name}`}>
            <Button.Icon>
              <EllipsisVertical />
            </Button.Icon>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item disabled={index === 0} onSelect={() => move({ list: listIndex, index }, { list: listIndex, index: index - 1 })}>
              Move up
            </Menu.Item>
            <Menu.Item disabled={index === last} onSelect={() => move({ list: listIndex, index }, { list: listIndex, index: index + 1 })}>
              Move down
            </Menu.Item>
            <Menu.Separator />
            {lists.map((list, target) => (
              <Menu.Item
                key={list.id}
                disabled={target === listIndex}
                onSelect={() => move({ list: listIndex, index }, { list: target, index: list.channels.length })}
              >
                Move to {list.name}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>
      </Stack.Root>
    </li>
  );
}

function ChannelList({
  group,
  listIndex,
  lists,
  move,
  landing,
  landed,
}: {
  group: ReorderGroup<number>;
  listIndex: number;
  lists: readonly List[];
  move: Move;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
}) {
  const list = lists[listIndex]!;
  const labelId = useId();
  // A drop inside this list goes to its own onMove, and a drop from the other list to the group's.
  const reorder = useReorder({
    group,
    list: listIndex,
    onMove: (from, to) => move({ list: listIndex, index: from }, { list: listIndex, index: to }),
  });
  // The list props go on the element around the rows, so a drop below the last row, or in the
  // empty list, lands at its end.
  return (
    <Stack.Root
      gap="condensed"
      {...reorder.getListProps()}
      style={{
        minBlockSize: '8rem',
        padding: 'var(--todae-space-2)',
        borderRadius: 'var(--todae-radius-md)',
        outline: reorder.drop && list.channels.length === 0 ? 'var(--todae-focus-ring-width) dashed var(--todae-color-accent-default)' : undefined,
      }}
    >
      <Text.Root id={labelId} variant="label">
        {list.name}
      </Text.Root>
      {list.channels.length > 0 ? (
        <Stack.Root as="ol" gap="none" aria-labelledby={labelId}>
          {list.channels.map((channel, index) => (
            <Row
              key={channel.id}
              channel={channel}
              index={index}
              listIndex={listIndex}
              lists={lists}
              reorder={reorder}
              move={move}
              landing={landing}
              landed={landed}
            />
          ))}
        </Stack.Root>
      ) : (
        <Text.Root tone="muted">No channels</Text.Root>
      )}
    </Stack.Root>
  );
}

const LISTS: List[] = [
  {
    id: 'pinned',
    name: 'Pinned',
    channels: [
      { id: 'design', name: 'Design' },
      { id: 'engineering', name: 'Engineering' },
    ],
  },
  {
    id: 'other',
    name: 'Other',
    channels: [
      { id: 'marketing', name: 'Marketing' },
      { id: 'sales', name: 'Sales' },
      { id: 'support', name: 'Support' },
    ],
  },
];

export default function BetweenListsExample() {
  const [lists, setLists] = useState(LISTS);
  const announce = useAnnouncer();
  // The trigger of the row that last moved to the other list, which takes focus from the row's
  // old element.
  const landing = useRef<HTMLButtonElement | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  const move: Move = (from, to) => {
    const channel = lists[from.list]!.channels[from.index]!;
    const next = moveChannel(lists, from, to);
    if (to.list !== from.list) setLanded(channel.id);
    setLists(next);
    const list = next[to.list]!;
    announce(`${channel.name} moved to ${list.name}, position ${to.index + 1} of ${list.channels.length}`);
  };
  // Both paths, a drag and a menu, call the same move.
  const group = useReorderGroup<number>({ onMove: move });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: 'var(--todae-space-3)', inlineSize: '100%' }}>
      {lists.map((list, listIndex) => (
        <ChannelList key={list.id} group={group} listIndex={listIndex} lists={lists} move={move} landing={landing} landed={landed} />
      ))}
    </div>
  );
}
