import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Actions',
  description: 'A row below the content for the message\'s actions, such as copy and retry. A div; put a Toolbar.Root in it for arrow-key focus.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Buttons, or a Toolbar.Root holding them.',
    },
  ],
} as const satisfies ComponentMeta;
