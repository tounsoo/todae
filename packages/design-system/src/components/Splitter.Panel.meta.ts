import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Splitter.Panel',
  description:
    'One of the two panels. A `div` that scrolls its own overflow, with an id the handle points at. While it is the collapsed primary panel it is hidden from the tab order and the accessibility tree. Takes native div attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The panel\'s content.',
    },
  ],
} as const satisfies ComponentMeta;
