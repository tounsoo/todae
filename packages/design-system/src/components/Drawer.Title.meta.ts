import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drawer.Title',
  description: 'Heading. Wires aria-labelledby on the drawer.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
