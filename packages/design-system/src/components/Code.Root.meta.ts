import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Code.Root',
  description: 'A native code styled from the code tokens: inline, in the text color around it, on a box tinted from that color. Takes native code attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The code.',
    },
  ],
} as const satisfies ComponentMeta;
