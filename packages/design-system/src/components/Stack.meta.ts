import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Stack',
  kind: 'component',
  description: 'Flex layout. Gap comes from the stack.gap contract token.',
  whenToUse: [
    'Flex layout between fields or sections. Gap comes from the stack.gap contract token.',
  ],
  whenNotToUse: [
    'Do not wrap a label/control pair in Stack. Use .labelled-field for that gap.',
  ],
  intents: [
    'layout',
  ],
  docs: '/stack',
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
