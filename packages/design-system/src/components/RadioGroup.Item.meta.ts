import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'RadioGroup.Item',
  description: 'One option in a RadioGroup. No checked, name, or invalid. Children are the visible label.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Option value. The group owns selection.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'Visible label.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Disables this option. The group disabled flag also applies.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the wrapping label.',
    },
  ],
} as const satisfies ComponentMeta;
