import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tree.Icon',
  description: 'An aria-hidden slot for an icon before the item text. An svg or img inside takes tree.icon.size.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The icon, such as a file or folder from your icon library.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the slot.',
    },
  ],
} as const satisfies ComponentMeta;
