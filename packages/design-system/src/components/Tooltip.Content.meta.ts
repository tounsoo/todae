import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip.Content',
  description: 'Tip surface is text-only. Interactive surface is role=dialog and allows links only.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name. Required when Tooltip is interactive.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tooltip text, or short prose plus links when interactive.',
    },
  ],
} as const satisfies ComponentMeta;
