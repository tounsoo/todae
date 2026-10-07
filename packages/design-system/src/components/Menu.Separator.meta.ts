import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Separator',
  description:
    'role="separator" between items or groups.',
  props: [
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
