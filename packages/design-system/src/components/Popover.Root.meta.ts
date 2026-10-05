import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Popover.Root',
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
      description: 'Accessible name when no visible caption exists. Only with role="dialog"; a role-less popover drops it, so name its contents instead.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of the visible caption. Only with role="dialog"; a role-less popover drops it.',
    },
    {
      name: 'role',
      type: '"dialog"',
      required: false,
      description: 'Non-modal dialog role. Requires aria-label or aria-labelledby. Does not set aria-modal.',
    },
  ],
} as const satisfies ComponentMeta;
