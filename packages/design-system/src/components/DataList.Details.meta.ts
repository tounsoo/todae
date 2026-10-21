import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DataList.Details',
  description: 'A native dd, the value for the term in the same item. Takes native dd attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The value. Put a list of values in one DataList.Details.',
    },
  ],
} as const satisfies ComponentMeta;
