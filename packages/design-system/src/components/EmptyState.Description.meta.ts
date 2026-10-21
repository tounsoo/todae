import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'EmptyState.Description',
  description: 'Muted text under the title, kept to a readable width. A `div`, so it can hold more than one paragraph or a link.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Description text, or any content.',
    },
  ],
} as const satisfies ComponentMeta;
