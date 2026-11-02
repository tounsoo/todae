import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useControlledState',
  description:
    'useControlledState(controlled, defaultValue, onChange) returns [value, change, latest]. change(next, ...args) builds on the latest write: it skips a value equal to it (Object.is), stores it when uncontrolled, then calls onChange(next, ...args). A controlled change the owner does not pass back by the next render is dropped, and a controlled value with no onChange is read-only.',
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
      description: 'Called with each new value and any extra arguments, such as a reason, controlled or not. Without it a controlled value is read-only.',
    },
  ],
} as const satisfies ComponentMeta;
