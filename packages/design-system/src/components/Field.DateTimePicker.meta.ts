import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateTimePicker',
  description:
    "A button that opens a Calendar and a list of times in a popover, side by side, or the list under the calendar on a narrow screen. A picked date and a picked time make the value, and picking a time while the calendar holds a date it offers closes the popover. On its own it is the field's control, shows the date and time, and a press elsewhere in the field opens the popover. Beside any other control but a Field.ColorPicker, Field.DatePicker, Field.DateRangePicker, Field.TimePicker or Field.DateTimePicker, such as a Field.TextInput to type the date and time in, that control is the field's control. With showValue set to false, the button shows only a calendar glyph. Takes native button attributes except type, value, defaultValue, placeholder, onChange and children.",
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDateTime | null',
      required: true,
      description: 'The date and time, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainDateTime) => void',
      required: false,
      description: 'Fires with the date and time when a pick leaves a date the calendar offers and a time in range for it.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainDateTime',
      required: false,
      description: 'The earliest date and time that can be picked.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDateTime',
      required: false,
      description: 'The latest date and time that can be picked.',
    },
    {
      name: 'isDateDisabled',
      type: '(date: Temporal.PlainDate) => boolean',
      required: false,
      description: 'Returns true for a date that cannot be picked, such as a holiday.',
    },
    {
      name: 'firstDayOfWeek',
      type: '1 | 2 | 3 | 4 | 5 | 6 | 7',
      required: false,
      description: "The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7.",
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
      description: 'The locale for the button\'s text, the calendar\'s names and the times, such as "ko". The browser\'s own when not set, so pass it when the picker renders on a server.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Shown on the button while there is no date and time, when showValue is true.',
    },
    {
      name: 'showValue',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Whether the button shows the date and time, or the placeholder, beside its glyph. Set it to false beside a text input that shows them.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state of the popover. Pass with onOpenChange.',
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
      description: 'Fires when the popover opens or closes, with why it closed.',
    },
  ],
} as const satisfies ComponentMeta;
