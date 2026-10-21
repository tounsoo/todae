import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DataList.Item',
  description: 'A div that groups one term with its details, valid inside a dl. Takes native div attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'One DataList.Term, then one DataList.Details.',
    },
  ],
} as const satisfies ComponentMeta;
