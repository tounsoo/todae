import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tree.Group',
  description: 'A role="group" list of the Tree.Item children of an item. Hidden while that item is closed.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tree.Item children. Leave it empty for a branch whose children load when it opens.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the group.',
    },
  ],
} as const satisfies ComponentMeta;
