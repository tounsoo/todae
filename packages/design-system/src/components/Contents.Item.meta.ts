import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Contents.Item',
  description: 'One entry in a Contents.Root or Contents.List. An li; takes native li attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A Contents.Link, or a Contents.Link followed by the Contents.List of its sub-sections.',
    },
  ],
} as const satisfies ComponentMeta;
