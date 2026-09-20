import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip.Content',
  description:
    'Tip surface is text-only. Interactive surface is a non-modal tip dialog (role=dialog) and allows links only.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description:
        'Accessible name when no visible caption exists. Exactly one of aria-label or aria-labelledby when interactive.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of the visible caption. Exactly one of aria-label or aria-labelledby when interactive.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tooltip text, or short prose plus links when interactive.',
    },
  ],
} as const satisfies ComponentMeta;
