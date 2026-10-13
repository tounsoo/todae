import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ColorPicker.Hue',
  description: 'A native range input over the hues, 0 to 359 degrees. Takes native input attributes except type, value, min, max, step and disabled.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Hue"',
      description: 'Its name. Without it, the hue string from StringsProvider names it.',
    },
  ],
} as const satisfies ComponentMeta;
