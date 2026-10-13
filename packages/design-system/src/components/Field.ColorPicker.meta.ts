import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.ColorPicker',
  description:
    "The field's control: a button one line of field text tall, filled with the color. It opens a ColorPicker in a popover, as does a press elsewhere in the field. Takes native button attributes except type, value, defaultValue, color, onChange and children.",
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'The color as #rrggbb.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Fires with the new color as #rrggbb while it is dragged or keyed in the picker.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state of the picker. Pass with onOpenChange.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      description: 'Initial open state when uncontrolled.',
    },
    {
      name: 'onOpenChange',
      type: "(open: boolean, reason: 'escape' | 'outside' | 'trigger' | 'disabled') => void",
      required: false,
      description: 'Fires when the picker opens or closes, with why it closed.',
    },
  ],
} as const satisfies ComponentMeta;
