import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.TimeInput',
  description:
    "A text input for a time of day, typed freely in the locale's own way, such as 9:30 pm. It reads the text on blur, Enter and a submit of its form, rewrites it and calls onValueChange; text that is no time stays and blocks a submit. The text is written with formatTime. The time goes in a native input the browser validates, sent under the field's name as HTML writes a time, such as 21:30, so required, min and max block a submit and Form.Root shows them. Beside a Field.Picker, a press on it while read-only opens the picker. It takes native input attributes except type, value, defaultValue, onChange, min, max, step, disabled, required, pattern, maxLength, minLength, list and multiple.",
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainTime | null',
      required: true,
      description: 'The time, or null for none.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainTime | null) => void',
      required: false,
      description: "Fires on a person's commit, on blur, Enter or a submit of the form, with the time the text says, read with parseTime, or null for an empty text. Typing alone fires nothing, and text that is no time stays, invalid. Without it the input is read-only.",
    },
    {
      name: 'min',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'The earliest time. A form with an earlier time is invalid. Later than max, it makes an overnight range, from min through midnight to max.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'The latest time. A form with a later time is invalid.',
    },
    {
      name: 'required',
      type: 'boolean',
      required: false,
      description: 'A form with no time is invalid.',
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
