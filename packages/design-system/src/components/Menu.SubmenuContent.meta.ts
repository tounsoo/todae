import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.SubmenuContent',
  description:
    'role="menu" in a popover past the end of its trigger, flipping sides where there is no room. Named by its trigger. Left arrow (right in RTL) or Escape closes it and focuses the trigger; Tab or choosing an item closes the whole menu.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Items, groups, separators and submenus.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
