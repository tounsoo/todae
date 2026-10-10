import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Row',
  description: 'A native tr. Takes native tr attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Table.HeaderCell and Table.Cell parts.',
    },
  ],
} as const satisfies ComponentMeta;
