import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Badge.Root',
  description: 'A short static label or count in one of five tones. A span with no role; takes native span attributes.',
  props: [
    {
      name: 'tone',
      type: '"neutral" | "info" | "success" | "warning" | "critical"',
      required: false,
      default: '"neutral"',
      description: 'Colors from the badge.<tone> contract tokens.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Label text or a number.',
    },
  ],
} as const satisfies ComponentMeta;
