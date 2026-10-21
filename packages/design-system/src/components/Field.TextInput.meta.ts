import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.TextInput',
  description: 'Controlled text-ish input inside Field.Root.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Controlled value.',
    },
    {
      name: 'onChange',
      type: '(event: ChangeEvent<HTMLInputElement>) => void',
      required: false,
      description: 'Native change handler. Optional when onValueChange is enough.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Optional value callback.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Native placeholder.',
    },
    {
      name: 'type',
      type: '"text" | "search" | "email" | "url" | "tel" | "password"',
      required: false,
      default: '"text"',
      description:
        'Native input type. A number uses Field.NumberInput, a time Field.TimePicker, a date Field.DatePicker and both Field.DateTimePicker, with a text input beside any of the pickers read by parseTime, parseDate or parseDateTime.',
    },
  ],
} as const satisfies ComponentMeta;
