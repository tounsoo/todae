import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ChipField.Input',
  description: 'Optional input slot. Rendered automatically when omitted.',
  props: [
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Native placeholder.',
    },
  ],
} as const satisfies ComponentMeta;
