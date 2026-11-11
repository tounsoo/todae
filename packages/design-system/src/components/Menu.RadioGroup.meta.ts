import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.RadioGroup',
  description:
    'A Menu.Group that owns one value for its Menu.RadioItem children.',
  props: [
    {
      name: 'value',
      type: 'string | null',
      required: false,
      description: 'Controlled value. null is controlled with nothing checked.',
    },
    {
      name: 'defaultValue',
      type: 'string | null',
      required: false,
      description: 'Initial value when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Fires with the next value.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Group name. Exactly one of aria-label or aria-labelledby.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of a visible group caption.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Menu.RadioItem children.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
