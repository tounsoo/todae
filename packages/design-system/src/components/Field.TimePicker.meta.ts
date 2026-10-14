import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.TimePicker',
  description:
    "A button that opens a list of times in a popover and closes it on a picked time. On its own it is the field's control, shows the time, and a press elsewhere in the field opens the list. Beside any other control but a Field.ColorPicker, Field.DatePicker or Field.TimePicker, such as a Field.TextInput to type the time in, that control is the field's control. With showValue set to false, the button shows only a clock glyph. Takes native button attributes except type, value, defaultValue, placeholder, onChange and children.",
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainTime | null',
      required: true,
      description: 'The time, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainTime) => void',
      required: false,
      description: 'Fires with the time picked in the list.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'The earliest time the list offers.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'The latest time the list offers.',
    },
    {
      name: 'step',
      type: 'number',
      required: false,
      default: '30',
      description: 'Minutes between the times in the list, from midnight.',
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: 'The locale for the times\' text, such as "ko". The browser\'s own when not set, so pass it when the picker renders on a server.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Shown on the button while there is no time, when showValue is true.',
    },
    {
      name: 'showValue',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Whether the button shows the time, or the placeholder, beside its glyph. Set it to false beside a text input that shows the time.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state of the list. Pass with onOpenChange.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      description: 'Initial open state when uncontrolled.',
    },
    {
      name: 'onOpenChange',
      type: "(open: boolean, reason: 'escape' | 'outside' | 'trigger' | 'select' | 'disabled') => void",
      required: false,
      description: 'Fires when the list opens or closes, with why it closed.',
    },
  ],
} as const satisfies ComponentMeta;
