import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateRangePicker',
  description:
    "A button that opens a Calendar in range mode in a popover, which closes once the range's second date is picked. On its own it is the field's control, shows the range, and a press elsewhere in the field opens the calendar. Beside any other control but a Field.ColorPicker, Field.DatePicker, Field.DateRangePicker, Field.TimePicker or Field.DateTimePicker, such as a Field.TextInput to type the range in, that control is the field's control. With showValue set to false, the button shows only a calendar glyph. With a name, a hidden input sends the range as an ISO 8601 interval, such as 2026-10-03/2026-10-10. Takes native button attributes except type, value, defaultValue, placeholder, onChange and children.",
  props: [
    {
      name: 'value',
      type: 'DateRange | null',
      required: true,
      description: 'The range, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: DateRange) => void',
      required: false,
      description: 'Fires with the range picked in the calendar, once its second date is picked.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The earliest date that can be picked.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The latest date that can be picked.',
    },
    {
      name: 'isDateDisabled',
      type: '(date: Temporal.PlainDate) => boolean',
      required: false,
      description: "Returns true for a date that cannot be picked, such as a holiday. A range can't hold one.",
    },
    {
      name: 'firstDayOfWeek',
      type: '1 | 2 | 3 | 4 | 5 | 6 | 7',
      required: false,
      description: "The calendar's first column, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7.",
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: 'The locale for the button\'s dates and the calendar\'s names, such as "ko". The browser\'s own when not set, so pass it when the picker renders on a server.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Shown on the button while there is no range, when showValue is true.',
    },
    {
      name: 'showValue',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Whether the button shows the range, or the placeholder, beside its glyph. Set it to false beside a text input that shows the range.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state of the calendar. Pass with onOpenChange.',
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
      description: 'Fires when the calendar opens or closes, with why it closed.',
    },
  ],
} as const satisfies ComponentMeta;
