import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Composer.Toolbar',
  description: 'The row Composer.Submit sits in, under the input.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The buttons in the row, including Composer.Submit.',
    },
  ],
} as const satisfies ComponentMeta;
