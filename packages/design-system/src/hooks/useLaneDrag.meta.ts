import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useLaneDrag',
  description:
    'useLaneDrag({ range, onDrop }) returns { getBoardProps, getLaneProps, getQueueProps, getItemProps, getHandleProps, drag }, prop getters that let a person drag items along lanes that share one axis, such as talks on a conference\'s stages: place an item from a queue, move it along its lane or to another, resize either end, or take it back to the queue. With onCreate, a press on empty lane space drags out a new place. Places snap to grid, check says whether a place conflicts with others, and a drop calls onDrop(change). A create calls onCreate instead. The board scrolls while the pointer is near its edge, counted from past its scroll-padding, which marks a strip sticky parts such as lane names cover. Escape cancels a drag. It has no keyboard path: pair it with a way to move an item, and a way to create one, without dragging, such as a dialog.',
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
      description: "Called on a drop that changes an item's place, with the change. A create calls onCreate instead.",
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
      description:
        'The shortest span a resize leaves, and the span a click on empty lane space creates, from the grid cell that contains the press. Default 0, so that click does nothing.',
    },
    {
      name: 'check',
      type: '(id: string, to: LanePlace) => LaneVerdict | null',
      required: false,
      description: 'Says whether the item `id` may go to `to`, each time the place under the pointer changes and again at the drop.',
    },
    {
      name: 'onCreate',
      type: '(place: LanePlace) => void',
      required: false,
      description:
        'Called once when a press on empty lane space ends on a new place. Omit it and empty space starts nothing. A drag sets the span between the press and the pointer. Dragged forward, the press floors to the grid cell that contains it. Dragged back, that cell runs up to the next grid point. The end under the pointer snaps to the nearest grid point. A press that stays inside the drag threshold creates a slot `minSpan` long from that cell, swallows the lane\'s click, and does nothing when `minSpan` is 0.',
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
