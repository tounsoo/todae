import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Pagination.Ellipsis',
  description: 'Stands for the pages a gap leaves out. Hidden from assistive technology. Takes native li attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      default: '"…"',
      description: 'What the gap shows.',
    },
  ],
} as const satisfies ComponentMeta;
