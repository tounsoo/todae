import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Disclosure.Summary',
  description: 'A native summary: the toggle that stays visible. From the main entry, it takes focus when code closes the disclosure while its content holds focus. Takes native summary attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The toggle text. It names the disclosure for screen readers.',
    },
  ],
} as const satisfies ComponentMeta;
