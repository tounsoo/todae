import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.DateInput',
  description:
    'Controlled native <input type="date"> inside Field.Root whose value is a Temporal.PlainDate. Todae ships no Temporal polyfill.',
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDate | null',
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
      type: '(value: Temporal.PlainDate | null) => void',
      required: false,
      description: 'Called with the new Temporal.PlainDate, or null while the input is empty or incomplete.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'Earliest value the input accepts, written to the native min.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDate',
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
