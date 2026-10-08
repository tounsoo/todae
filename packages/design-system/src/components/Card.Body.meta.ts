import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Card.Body',
  description: 'Main content of the card. A div.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Body content.',
    },
  ],
} as const satisfies ComponentMeta;
