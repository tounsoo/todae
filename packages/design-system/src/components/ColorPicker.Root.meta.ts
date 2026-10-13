import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ColorPicker.Root',
  description:
    'A role="group" that holds the color for its ColorPicker.Area and ColorPicker.Hue. The color is #rrggbb; the parts work in hue, saturation and brightness, and keep the hue while the color is a gray.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: false,
      description: 'Controlled color as #rrggbb. Pass with onValueChange.',
    },
    {
      name: 'defaultValue',
      type: 'string',
      required: false,
      default: '"#000000"',
      description: 'Initial color as #rrggbb when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Fires with the new color as #rrggbb while it is dragged or keyed.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Stops every part from changing the color. A disabled Fieldset sets it too.',
    },
  ],
} as const satisfies ComponentMeta;
