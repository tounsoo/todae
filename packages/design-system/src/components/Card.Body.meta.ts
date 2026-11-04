import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Card.Body',
  description: 'Main content of the card. A div that grows into the card\'s free height, so the footer sits at the bottom of a card stretched taller than its content.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Body content.',
    },
  ],
} as const satisfies ComponentMeta;
