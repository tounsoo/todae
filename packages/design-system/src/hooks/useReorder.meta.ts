import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useReorder',
  description:
    "useReorder({ onMove }) returns { dragging, drop, getItemProps, getHandleProps }, which let a person reorder a list by dragging an item's handle, with the browser's drag and drop. A drop that changes the order calls onMove(from, to). It has no keyboard path: pair it with a way to move an item without dragging, such as a menu.",
  props: [
    {
      name: 'onMove',
      type: '(from: number, to: number) => void',
      required: true,
      description: "Called on a drop that changes the order, with the dragged item's index and the index it ends at.",
    },
    {
      name: 'orientation',
      type: "'vertical' | 'horizontal'",
      required: false,
      default: "'vertical'",
      description: "The axis the items run along. Default 'vertical'. In a horizontal list, 'before' follows the text direction.",
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
