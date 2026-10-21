import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DataList.Term',
  description: 'A native dt, the term for the details beside or below it. Takes native dt attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The term, as text.',
    },
  ],
} as const satisfies ComponentMeta;
