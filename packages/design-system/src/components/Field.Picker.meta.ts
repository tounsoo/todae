import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Picker',
  description:
    "A button in a field that opens a popover around a panel, such as a Calendar.Root, an OptionList.Root or a ColorPicker.Root, and closes it once a pick in a Calendar or OptionList makes the value. Pass the panel the same value as the typed input beside it, such as a Field.DateInput, which shows and sends it. Beside another control, that control is the field's and the button is named label; alone, the button is the field's control and sends nothing. Alone, a press elsewhere in the field opens it; beside a typed input, such a press focuses the input, and a press on a read-only typed input opens it. The popover is a dialog that Escape and a press outside close, with focus back on the button. It takes native button attributes except type, value, defaultValue, onChange, color and children.",
  props: [
    {
      name: 'label',
      type: 'string',
      required: false,
      default: 'from the typed input beside it',
      description: "The button's name beside another control, and the popover's name: the datePicker, timePicker, dateTimePicker or dateRangePicker string from StringsProvider beside a Field.DateInput, Field.TimeInput, Field.DateTimeInput or Field.DateRangeInput, else colorPicker with swatch and picker without.",
    },
    {
      name: 'glyph',
      type: 'ReactNode',
      required: false,
      default: 'a calendar beside a date input, a clock beside a time input, else a chevron',
      description: 'What the button shows, from GlyphsProvider by default.',
    },
    {
      name: 'swatch',
      type: 'string',
      required: false,
      description: "A CSS color, such as a ColorPicker's value, that makes the button a swatch filled with it, one line of field text tall, in place of a glyph.",
    },
    {
      name: 'closeOnPick',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Whether a pick in a Calendar or OptionList inside closes the popover. Set false for a panel that takes more than one pick, such as a Calendar beside an OptionList of times, and call close once the value is whole.',
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
      type: '(open: boolean, reason: FieldPickerCloseReason) => void',
      required: false,
      description: "Fires when the popover opens or closes, with why it closed: 'select' for a pick or close, 'escape', 'outside', 'trigger', or 'disabled' when the field becomes disabled.",
    },
    {
      name: 'children',
      type: 'ReactNode | ((controls: { close: () => void }) => ReactNode)',
      required: false,
      description: 'What the popover holds, mounted only while it is open. A function gets close, for a panel of your own.',
    },
  ],
} as const satisfies ComponentMeta;
