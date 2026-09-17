import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'TextField.Input',
  description: 'Controlled text-ish input inside TextField.',
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
      type: '"text" | "search" | "email" | "url" | "tel" | "password"',
      required: false,
      default: '"text"',
      description: 'Text-ish input types only.',
    },
  ],
} as const satisfies ComponentMeta;
