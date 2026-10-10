import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Badge.Root',
  description: 'A short static label or count in a status or category tone. A span with no role; takes native span attributes.',
  props: [
    {
      name: 'tone',
      type: '"neutral" | "info" | "success" | "warning" | "critical" | "category-1" | "category-2" | "category-3" | "category-4" | "category-5" | "category-6" | "category-7" | "category-8"',
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
