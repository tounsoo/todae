import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'EmptyState.Actions',
  description: 'A centered row of buttons or links that wraps. A div with no role.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Buttons or links.',
    },
  ],
} as const satisfies ComponentMeta;
