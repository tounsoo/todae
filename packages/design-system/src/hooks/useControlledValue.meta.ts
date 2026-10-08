import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useControlledValue',
  description:
    'useControlledValue(controlled, defaultValue, onChange) returns [value, change]. change(next, ...args) skips a value equal to the one from the last render (Object.is), stores it when uncontrolled, then calls onChange(next, ...args).',
  props: [
    {
      name: 'controlled',
      type: 'T | undefined',
      required: true,
      description: 'The value prop. undefined means uncontrolled, so use null for an empty controlled value.',
    },
    {
      name: 'defaultValue',
      type: 'T',
      required: true,
      description: 'Starting value when uncontrolled. Read on the first render only.',
    },
    {
      name: 'onChange',
      type: '(next: T, ...args: A) => void',
      required: false,
      description: 'Called with each new value and any extra arguments, such as a reason, controlled or not.',
    },
  ],
} as const satisfies ComponentMeta;
