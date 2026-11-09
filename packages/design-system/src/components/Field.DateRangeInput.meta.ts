import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateRangeInput',
  description:
    "A text input for a range of dates, typed freely as two dates in the locale's own way. It reads the text on blur, Enter and a submit of its form, rewrites it and calls onValueChange, with the earlier date as start; text that is no range stays and blocks a submit. The text is written with formatDateRange. The range goes in a native input the browser validates, sent under the field's name as an ISO 8601 interval, such as 2026-10-03/2026-10-10, so required, min and max block a submit and Form.Root shows them. Beside a Field.Picker, a press on it while read-only opens the picker. It takes native input attributes except type, value, defaultValue, onChange, min, max, step, disabled, required, pattern, maxLength, minLength, list and multiple.",
  props: [
    {
      name: 'value',
      type: 'DateRange | null',
      required: true,
      description: 'The range, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: DateRange | null) => void',
      required: false,
      description: "Fires on a person's commit, on blur, Enter or a submit of the form, with the range the text says, read with parseDateRange, or null for an empty text. Typing alone fires nothing, and text that is no range stays, invalid. Without it the input is read-only.",
    },
    {
      name: 'min',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The earliest date the range can hold. A form with a range that starts earlier is invalid.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The latest date the range can hold. A form with a range that ends later is invalid.',
    },
    {
      name: 'required',
      type: 'boolean',
      required: false,
      description: 'A form with no range is invalid.',
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: "The locale the text is read and written in, such as \"ko\". The browser's own when not set, so pass it when the input renders on a server.",
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Native placeholder.',
    },
  ],
} as const satisfies ComponentMeta;
