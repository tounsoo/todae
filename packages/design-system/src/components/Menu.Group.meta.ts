import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Group',
  description:
    'role="group" inside a menu. Requires aria-label or aria-labelledby.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Group name. Exactly one of aria-label or aria-labelledby.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of a visible group caption.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Items.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
