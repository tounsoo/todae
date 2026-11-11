import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Foot',
  description: 'A native tfoot, for totals or notes under the data. Takes native tfoot attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Table.Row parts with the totals.',
    },
  ],
} as const satisfies ComponentMeta;
