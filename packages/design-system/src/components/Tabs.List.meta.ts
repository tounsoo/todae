import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tabs.List',
  description: 'The tablist. Holds one tab stop; arrow keys, Home and End move between tabs. A horizontal list scrolls sideways when its tabs do not fit.',
  props: [
    {
      name: 'arrows',
      type: 'boolean',
      required: false,
      default: 'true',
      description:
        'Whether a horizontal list shows an arrow at each edge where tabs are cut off, while there is more to scroll that way. Resting a mouse or pen on one scrolls toward it. The arrows are for the pointer only: touch, a wheel and the arrow keys scroll the list as before, and assistive technology never meets them. A vertical list never scrolls, so it shows none.',
    },
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
