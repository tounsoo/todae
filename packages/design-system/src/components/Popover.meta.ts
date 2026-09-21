import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Popover',
  description: 'Surface chrome. Spread getPopoverProps for wire.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Popover contents.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Class name for the surface.',
    },
    {
      name: 'style',
      type: 'React.CSSProperties',
      required: false,
      description: 'Style for the surface. Anchor position comes from getPopoverProps.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name when no visible caption exists.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of the visible caption.',
    },
  ],
} as const satisfies ComponentMeta;
