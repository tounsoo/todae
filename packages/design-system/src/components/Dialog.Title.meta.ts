import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Title',
  description: 'Heading. Wires aria-labelledby on the dialog.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
