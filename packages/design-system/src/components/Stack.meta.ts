import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Stack',
  description: 'Flex layout. Gap comes from the stack.gap contract token.',
  props: [
    {
      name: 'direction',
      type: '"row" | "column"',
      required: false,
      default: '"column"',
      description: 'Flex direction.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Laid-out children.',
    },
  ],
} as const satisfies ComponentMeta;
