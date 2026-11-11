import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tabs.Tab',
  description: 'A native button with role="tab". Controls the Tabs.Panel with the same value.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Matches a Tabs.Panel value.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Native disabled. Skipped by arrow keys.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tab label.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the tab.',
    },
  ],
} as const satisfies ComponentMeta;
