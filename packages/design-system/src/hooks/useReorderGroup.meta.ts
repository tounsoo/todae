import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useReorderGroup',
  description:
    "useReorderGroup({ onMove }) returns a group for useReorder. Lists that pass it, each with its own list key, take each other's items: a drop in another list of the group calls onMove(from, to) with each list's key and index. A drop inside one list still calls that list's own onMove.",
  props: [
    {
      name: 'onMove',
      type: '(from: ReorderPlace<L>, to: ReorderPlace<L>) => void',
      required: true,
      description:
        'Called on a drop that moves an item from one of the group\'s lists to another, with the list and index it leaves and the list and index it ends at.',
    },
  ],
} as const satisfies ComponentMeta;
