import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useLaneDrag',
  description:
    'useLaneDrag({ range, onDrop }) returns { getBoardProps, getLaneProps, getQueueProps, getItemProps, getHandleProps, drag }, prop getters that let a person drag items along lanes that share one axis, such as talks on a conference\'s stages: place an item from a queue, move it along its lane or to another, resize either end, or take it back to the queue. Places snap to grid, check says whether a place conflicts with others, and a drop calls onDrop(change). Escape cancels a drag. It has no keyboard path: pair it with a way to move an item without dragging, such as a dialog.',
  props: [
    {
      name: 'range',
      type: '{ start: number; end: number }',
      required: true,
      description: "The span every lane's element covers along the axis, in the board's units, such as minutes from the first day's start.",
    },
    {
      name: 'onDrop',
      type: '(change: LaneDragChange) => void',
      required: true,
      description: "Called on a drop that changes an item's place, with the change.",
    },
    {
      name: 'axis',
      type: "'inline' | 'block'",
      required: false,
      default: "'inline'",
      description: 'The direction the range runs in each lane. `inline` follows the text direction, and `block` runs down. Default `inline`.',
    },
    {
      name: 'grid',
      type: 'readonly number[]',
      required: false,
      description: "The points a start or end snaps to, in ascending order. Without it, places don't snap.",
    },
    {
      name: 'minSpan',
      type: 'number',
      required: false,
      default: '0',
      description: 'The shortest span a resize leaves. Default 0.',
    },
    {
      name: 'check',
      type: '(id: string, to: LanePlace) => LaneVerdict | null',
      required: false,
      description: 'Says whether the item `id` may go to `to`, each time the place under the pointer changes.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: "Turn dragging off. While `disabled` is true, a drag under way can't be dropped.",
    },
  ],
} as const satisfies ComponentMeta;
