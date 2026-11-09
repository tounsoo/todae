import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateInput',
  description:
    "A text input for a date, typed freely in the locale's own numbers or words. It reads the text on blur, Enter and a submit of its form, rewrites it and calls onValueChange; text that is no date stays and blocks a submit. The text is written with formatDate. The date goes in a native input the browser validates, sent under the field's name as HTML writes a date, such as 2026-10-13, so required, min and max block a submit and Form.Root shows them. Beside a Field.Picker, a press on it while read-only opens the picker. It takes native input attributes except type, value, defaultValue, onChange, min, max, step, disabled, required, pattern, maxLength, minLength, list and multiple.",
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDate | null',
      required: true,
      description: 'The date, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainDate | null) => void',
      required: false,
      description: "Fires on a person's commit, on blur, Enter or a submit of the form, with the date the text says, read with parseDate, or null for an empty text. Typing alone fires nothing, and text that is no date stays, invalid. Without it the input is read-only.",
    },
    {
      name: 'min',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The earliest date. A form with an earlier date is invalid.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The latest date. A form with a later date is invalid.',
    },
    {
      name: 'required',
      type: 'boolean',
      required: false,
      description: 'A form with no date is invalid.',
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
