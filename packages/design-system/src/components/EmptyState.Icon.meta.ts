import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'EmptyState.Icon',
  description: 'A slot for any icon, centered above the title. Hidden from assistive technology unless it says otherwise.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon graphic from your own icon set.',
    },
  ],
} as const satisfies ComponentMeta;
