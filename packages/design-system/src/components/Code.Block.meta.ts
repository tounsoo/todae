import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Code.Block',
  description: 'A native pre styled from the code.block tokens. It scrolls sideways when a line is too long; takes native pre attributes.',
  props: [
    {
      name: 'tabIndex',
      type: 'number',
      required: false,
      description: 'Set 0 when the block can scroll, so keyboard users can reach and scroll it.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The code, usually in a code element, which drops its own box here.',
    },
  ],
} as const satisfies ComponentMeta;
