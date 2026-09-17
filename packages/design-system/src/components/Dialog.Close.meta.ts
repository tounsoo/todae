import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Close',
  description: 'Ghost Button that requests close-button dismiss.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Close"',
      description: 'Accessible name.',
    },
  ],
} as const satisfies ComponentMeta;
