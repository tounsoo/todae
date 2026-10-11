import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.ColorInput',
  description:
    'Controlled native <input type="color"> inside Field.Root, drawn as a swatch one line of field text tall. A press elsewhere in the field opens the browser picker.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Controlled value as #rrggbb.',
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
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the input.',
    },
  ],
} as const satisfies ComponentMeta;
