import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Text',
  description: 'Text styled through the text contract tokens.',
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
      description: 'Maps to text.size.2, text.size.3, text.size.4.',
    },
    {
      name: 'tone',
      type: '"default" | "muted" | "accent"',
      required: false,
      default: '"default"',
      description: 'Foreground role.',
    },
    {
      name: 'weight',
      type: '"regular" | "medium" | "bold"',
      required: false,
      default: '"regular"',
      description: 'Font weight.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Text content.',
    },
  ],
} as const satisfies ComponentMeta;
