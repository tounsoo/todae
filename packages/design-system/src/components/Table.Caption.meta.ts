import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Caption',
  description: "A native caption: the table's name for screen readers. Put it first in Table.Root; takes native caption attributes.",
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'What the table holds.',
    },
  ],
} as const satisfies ComponentMeta;
