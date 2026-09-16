import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Stack',
  description: 'Flex layout with a direction and a gap.',
  props: [
    {
      name: 'direction',
      type: '"row" | "column"',
      required: false,
      default: '"column"',
      description: 'Flex direction.',
    },
    {
      name: 'gap',
      type: '"s" | "m" | "l"',
      required: false,
      default: '"m"',
      description: 'Space between children.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Laid-out children.',
    },
  ],
} as const satisfies ComponentMeta;
