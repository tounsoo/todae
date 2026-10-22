import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useReorder',
  description:
    'Returns { dragging, drop, getItemProps, getHandleProps }. Spread getItemProps(index) on each item of a list and getHandleProps(index) on the element inside it that a drag starts from. A press on a handle makes its item draggable with the browser\'s drag and drop, so a drag can start only from a handle. While an item is dragged, dragging is its index and drop says which item it would land beside and on which side, or is null when a drop there would not move it; the items carry data-dragging and data-drop for styles. A drop that changes the order calls onMove with the dragged item\'s index and the index it ends at. Drags from outside the list, such as files, are ignored. It has no keyboard path: pair it with a way to move an item without dragging, such as a menu.',
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
      description: 'Turn dragging off.',
    },
  ],
} as const satisfies ComponentMeta;
