import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DatePicker',
  description:
    "A button that opens a Calendar in a popover and closes it on a picked date. On its own it is the field's control, shows the date, and a press elsewhere in the field opens the calendar. Beside any other control but a Field.ColorPicker or Field.DatePicker, such as a Field.TextInput to type the date in, that control is the field's control. With showDate set to false, the button shows only a calendar glyph. Takes native button attributes except type, value, defaultValue, placeholder, onChange and children.",
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDate | null',
      required: true,
      description: 'The date, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainDate) => void',
      required: false,
      description: 'Fires with the date picked in the calendar.',
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
      description: 'Returns true for a date that cannot be picked, such as a holiday.',
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
      description: 'The locale for the button\'s date and the calendar\'s names, such as "ko". The browser\'s own when not set, so pass it when the picker renders on a server.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Shown on the button while there is no date.',
    },
    {
      name: 'showDate',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Whether the button shows the date, or the placeholder, beside its glyph. Set it to false beside a text input that shows the date.',
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
