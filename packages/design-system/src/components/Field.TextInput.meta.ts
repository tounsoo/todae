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
      required: true,
      description: 'Native change handler.',
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
      type: '"text" | "search" | "email" | "url" | "tel" | "password" | "number"',
      required: false,
      default: '"text"',
      description:
        'Native input type. Number keeps the native spinner, and value stays the input string, such as "42". A time uses Field.TimePicker and a date Field.DatePicker, with a text input beside either read by parseTime or parseDate; a date and time uses Field.DateTimeInput.',
    },
  ],
} as const satisfies ComponentMeta;
