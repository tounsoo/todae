import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'TextField.Prefix',
  description: 'Leading text or node before the input.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Prefix content. Strings render as text.',
    },
  ],
} as const satisfies ComponentMeta;
