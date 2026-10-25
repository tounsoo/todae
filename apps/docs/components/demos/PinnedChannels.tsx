"use client";

import {
  Button,
  Menu,
  Stack,
  Text,
  useAnnouncer,
  useReorder,
  type ReorderDrop,
} from "@tounsoo/todae";
import { EllipsisVertical, GripVertical } from "lucide-react";
import { useId } from "react";

export type Channel = { id: string; name: string };

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

// The grip spans the row's height, with padding beside the icon, so it is easy to hit: at least
// 24 by 24 CSS pixels (WCAG 2.2 SC 2.5.8).
const gripStyle = {
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  paddingInline: "var(--todae-space-control-x)",
  cursor: "grab",
  touchAction: "none",
  color: "var(--todae-color-fg-muted)",
} as const;

// A line at the edge the dragged row would land on.
function dropLine(drop: ReorderDrop | null, index: number) {
  if (drop?.index !== index) return undefined;
  const width = "var(--todae-focus-ring-width)";
  const offset = drop.position === "before" ? width : `calc(-1 * ${width})`;
  return `inset 0 ${offset} 0 var(--todae-color-accent-default)`;
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
    announce(
      `${channels[from]!.name} moved to position ${to + 1} of ${channels.length}`,
    );
  };
  const reorder = useReorder({ onMove: move });

  return (
    <>
      <Text.Root id={labelId} variant="label">
        Pinned channels
      </Text.Root>
      <Stack.Root as="ol" gap="none" aria-labelledby={labelId}>
        {channels.map((channel, index) => {
          const moves = [
            ["Move to top", 0],
            ["Move up", index - 1],
            ["Move down", index + 1],
            ["Move to bottom", last],
          ] as const;
          return (
            <li
              key={channel.id}
              {...reorder.getItemProps(index)}
              style={{
                boxShadow: dropLine(reorder.drop, index),
                background:
                  reorder.dragging === index
                    ? "var(--todae-color-bg-subtle)"
                    : undefined,
              }}
            >
              <Stack.Root direction="row" align="center" gap="condensed">
                <span
                  {...reorder.getHandleProps(index)}
                  aria-hidden
                  style={gripStyle}
                >
                  <GripVertical size="1em" />
                </span>
                <Text.Root style={{ flex: 1 }}>{channel.name}</Text.Root>
                <Menu.Root>
                  <Menu.Trigger
                    variant="ghost"
                    aria-label={`Move ${channel.name}`}
                  >
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
