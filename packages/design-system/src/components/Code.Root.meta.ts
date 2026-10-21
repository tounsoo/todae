import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Code.Root',
  description:
    'A native code styled from the code tokens: inline, in the text color around it, on a box tinted from that color. With as="pre", a native pre styled from the code.block tokens that scrolls sideways when a line is too long. Takes the native attributes of its element.',
  props: [
    {
      name: 'as',
      type: '"code" | "pre"',
      required: false,
      default: '"code"',
      description: 'Rendered element. A pre is a code block, and a code inside it drops its own box.',
    },
    {
      name: 'tabIndex',
      type: 'number',
      required: false,
      description: 'With as="pre", set 0 when the block can scroll, so keyboard users can reach and scroll it.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The code. In a pre, usually a code element.',
    },
  ],
} as const satisfies ComponentMeta;
