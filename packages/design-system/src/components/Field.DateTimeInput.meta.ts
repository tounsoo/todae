import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateTimeInput',
  description:
    "A text input for a date and a time of day, typed freely in the locale's own way. It reads the text on blur, Enter and a submit of its form, rewrites it and calls onValueChange; text that is no date and time stays and blocks a submit. The text is written with formatDateTime. The date and time goes in a native input the browser validates, sent under the field's name as HTML writes one, such as 2026-10-13T21:30, so required, min and max block a submit and Form.Root shows them. Beside a Field.Picker, a press on it while read-only opens the picker. It takes native input attributes except type, value, defaultValue, onChange, min, max, step, disabled, required, pattern, maxLength, minLength, list and multiple.",
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDateTime | null',
      required: true,
      description: 'The date and time, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainDateTime | null) => void',
      required: false,
      description: "Fires on a person's commit, on blur, Enter or a submit of the form, with the date and time the text says, read with parseDateTime, or null for an empty text. Typing alone fires nothing, and text that is no date and time stays, invalid. Without it the input is read-only.",
    },
    {
      name: 'min',
      type: 'Temporal.PlainDateTime',
      required: false,
      description: 'The earliest date and time. A form with an earlier one is invalid.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDateTime',
      required: false,
      description: 'The latest date and time. A form with a later one is invalid.',
    },
    {
      name: 'required',
      type: 'boolean',
      required: false,
      description: 'A form with no date and time is invalid.',
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
