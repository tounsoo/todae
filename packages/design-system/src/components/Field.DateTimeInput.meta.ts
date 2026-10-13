import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateTimeInput',
  description:
    'Controlled native <input type="datetime-local"> inside Field.Root whose value is a Temporal.PlainDateTime. Todae ships no Temporal polyfill.',
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDateTime | null',
      required: true,
      description: 'Controlled value, or null while the input is empty or incomplete.',
    },
    {
      name: 'onChange',
      type: '(event: ChangeEvent<HTMLInputElement>) => void',
      required: false,
      description: 'Native change handler. Optional when onValueChange is enough.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainDateTime | null) => void',
      required: false,
      description: 'Called with the new Temporal.PlainDateTime, or null while the input is empty or incomplete.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainDateTime',
      required: false,
      description: 'Earliest value the input accepts, written to the native min.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDateTime',
      required: false,
      description: 'Latest value the input accepts, written to the native max.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the input.',
    },
  ],
} as const satisfies ComponentMeta;
