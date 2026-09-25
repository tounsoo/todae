import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Counter',
  description: 'Live character count for Field.TextInput or Field.Textarea.',
  props: [
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Class on the count. Use it for the inline flex-basis override.',
    },
    {
      name: 'style',
      type: 'React.CSSProperties',
      required: false,
      description: 'Inline style. flex-basis: auto places the count on the input row.',
    },
  ],
} as const satisfies ComponentMeta;
