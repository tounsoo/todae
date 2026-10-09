import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Disclosure.Summary',
  description: 'A native summary: the toggle that stays visible. Takes native summary attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The toggle text. It names the disclosure for screen readers.',
    },
  ],
} as const satisfies ComponentMeta;
