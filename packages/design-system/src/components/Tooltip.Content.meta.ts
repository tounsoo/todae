import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip.Content',
  description: 'Tip surface is text-only. Panel surface allows links only.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tooltip text, or short prose plus links when interactive.',
    },
  ],
} as const satisfies ComponentMeta;
