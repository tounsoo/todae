import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'TextField.Suffix',
  description: 'Trailing text or node after the input.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Suffix content. Strings render as text.',
    },
  ],
} as const satisfies ComponentMeta;
