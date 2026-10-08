import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useControlledState',
  description:
    'useControlledState(controlled, defaultValue) returns [value, setValue]. While controlled is not undefined it is the value and setValue does nothing; otherwise setValue stores the next value. It never calls a change callback.',
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
  ],
} as const satisfies ComponentMeta;
