import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tabs.List',
  description: 'The tablist. Holds one tab stop; arrow keys, Home and End move between tabs.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the tablist when no visible caption exists.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of a visible caption for the tablist.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tabs.Tab children.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the tablist.',
    },
  ],
} as const satisfies ComponentMeta;
