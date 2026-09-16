import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Text',
  description: 'Text in a semantic element.',
  props: [
    {
      name: 'as',
      type: '"p" | "span" | "strong"',
      required: false,
      default: '"p"',
      description: 'Rendered element.',
    },
    {
      name: 'size',
      type: '"s" | "m" | "l"',
      required: false,
      default: '"m"',
      description: 'Font size.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Text content.',
    },
  ],
} as const satisfies ComponentMeta;
