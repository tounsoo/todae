import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.ColorPicker',
  description:
    "A button one line of field text tall, filled with the color, that opens a ColorPicker in a popover. On its own it is the field's control, and a press elsewhere in the field opens the picker. Beside any other control in the field but a Field.ColorPicker, Field.DatePicker, Field.DateRangePicker, Field.TimePicker or Field.DateTimePicker, such as a Field.TextInput, that control is the field's control. The color goes in a native text input under the field's name unless another control took it, so Field.Root's customValidity and a Form.Root scope see it. Takes native button attributes except type, value, defaultValue, color, onChange and children.",
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
