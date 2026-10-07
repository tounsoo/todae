import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tabs.Panel',
  description: 'role="tabpanel", labelled by its tab. Hidden unless its tab is selected.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Matches a Tabs.Tab value.',
    },
    {
      name: 'keepMounted',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Keep children mounted while hidden, so their state survives a tab switch.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Panel content.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the panel.',
    },
  ],
} as const satisfies ComponentMeta;
