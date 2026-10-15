import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'resolveSheetPresentation',
  description:
    "resolveSheetPresentation({ coarse, narrow }) returns sheet when either is true, else popover: useSheetPresentation's rule without its media queries.",
  props: [
    {
      name: 'coarse',
      type: 'boolean',
      required: true,
      description: 'Whether the pointer is coarse.',
    },
    {
      name: 'narrow',
      type: 'boolean',
      required: true,
      description: 'Whether the viewport is narrow.',
    },
  ],
} as const satisfies ComponentMeta;
