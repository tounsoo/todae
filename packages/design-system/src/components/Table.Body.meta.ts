import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Body',
  description: 'A native tbody. Takes native tbody attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Table.Row parts with the data.',
    },
  ],
} as const satisfies ComponentMeta;
