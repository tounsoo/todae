import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Content',
  description:
    'role="menu" in a popover anchored to the trigger. Named by the trigger unless aria-label or aria-labelledby is given.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the menu instead of the trigger.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of the element that names the menu. Default is the trigger.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Items, groups and separators.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
