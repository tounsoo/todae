import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.NumberInput',
  description:
    "A text input for a number, in the locale's own format, that the person types into freely. It parses on blur, Enter and each step, rewrites the text and calls onValueChange. The number goes in a native input the browser validates, so required, min and max block a submit and Form.Root shows them in the field's format. Arrow Up and Down step, Page Up and Page Down step by largeStep. Field.Increment and Field.Decrement beside it are step buttons. It is a native input with the spinbutton role, and takes native input attributes except type, role, value, defaultValue, onChange, min, max, step, disabled, required, pattern, maxLength, minLength, list and multiple.",
  props: [
    {
      name: 'value',
      type: 'number | null',
      required: true,
      description: 'The number, or null for none. Never NaN.',
    },
    {
      name: 'onValueChange',
      type: '(value: number | null) => void',
      required: false,
      description:
        "Fires on a person's commit, on blur, Enter, a step key or a step button, with a number within min and max, on step and rounded to the digits the text shows, or null for an empty text. Typing alone fires nothing. Without it the input is read-only.",
    },
    {
      name: 'min',
      type: 'number',
      required: false,
      description: 'The lowest number. A commit below it becomes it, and a form with a lower value is invalid.',
    },
    {
      name: 'max',
      type: 'number',
      required: false,
      description: 'The highest number. A commit above it becomes the highest number on the step that fits.',
    },
    {
      name: 'step',
      type: 'number',
      required: false,
      description:
        'The grid a commit snaps to, counted from min or from 0, and what the arrow keys and step buttons move by. It wins over the digits the text shows, so give a step no finer than they are. Without it a commit keeps every digit the text shows, and a key moves by 1, or by 0.01 for a percent.',
    },
    {
      name: 'largeStep',
      type: 'number',
      required: false,
      default: 'step × 10',
      description: 'What Page Up and Page Down move by.',
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: 'The locale for the number\'s text, such as "de". The browser\'s own when not set, so pass it when the input renders on a server.',
    },
    {
      name: 'formatOptions',
      type: 'NumberFormatOptions',
      required: false,
      description:
        "How the number is written, as Intl.NumberFormat takes it: style, such as percent or currency, and fraction digits, which a commit rounds to. Compact and scientific notation can't be read back, and significant digits and rounding options are not supported. Put a unit or a currency sign in a Field.Affix instead when you can.",
    },
    {
      name: 'required',
      type: 'boolean',
      required: false,
      description: 'A form with no number is invalid.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Native placeholder.',
    },
    {
      name: 'inputMode',
      type: '"numeric" | "decimal" | "text" | …',
      required: false,
      default: '"numeric" for a whole step and min of 0 or more in a format with no fraction digits, "decimal" for a min of 0 or more, else "text"',
      description: "Which keyboard a phone shows. The decimal keypad's separator is the device's, not locale's.",
    },
  ],
} as const satisfies ComponentMeta;
