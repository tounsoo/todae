import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.TimeInput',
  description:
    'Controlled native <input type="time"> inside Field.Root whose value is a Temporal.PlainTime. Todae ships no Temporal polyfill.',
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainTime | null',
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
      type: '(value: Temporal.PlainTime | null) => void',
      required: false,
      description: 'Called with the new Temporal.PlainTime, or null while the input is empty or incomplete.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'Earliest value the input accepts, written to the native min.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainTime',
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
