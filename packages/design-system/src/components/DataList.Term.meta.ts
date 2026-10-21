import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DataList.Term',
  description: 'A native dt, the name of the value beside or below it. Takes native dt attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The name of the value, as text.',
    },
  ],
} as const satisfies ComponentMeta;
