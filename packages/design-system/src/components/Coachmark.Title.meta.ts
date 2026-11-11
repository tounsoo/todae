import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Coachmark.Title',
  description: 'Bold Text.Root paragraph. Wires aria-labelledby on the popup.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
