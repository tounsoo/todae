import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'EmptyState.Icon',
  description: 'Slot for any icon, centered above the title. aria-hidden by default.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon graphic from your own icon set.',
    },
  ],
} as const satisfies ComponentMeta;
