import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Row',
  description: 'Full-width line of parts inside Field.Root. Placement = where it is written. Empty Row renders nothing.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Parts for the line, such as chips, buttons or Field.Counter.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Extra class on the row.',
    },
  ],
} as const satisfies ComponentMeta;
