import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ButtonGroup',
  description: 'Chrome-only attached row of Button.Root. role=group. No selection state.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name for the group.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Button.Root children. Horizontal only.',
    },
  ],
} as const satisfies ComponentMeta;
