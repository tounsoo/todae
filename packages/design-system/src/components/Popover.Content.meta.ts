import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Popover.Content',
  description: 'Manual popover surface. Syncs showPopover and hidePopover to the open prop.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name for the surface.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Popover contents.',
    },
  ],
} as const satisfies ComponentMeta;
