import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Nav.Item',
  description: 'One entry in a Nav.Group or Nav.Branch. An li; takes native li attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A Nav.Link, a Nav.Branch, or a Nav.Link followed by the Nav.Branch of its child pages.',
    },
  ],
} as const satisfies ComponentMeta;
