import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Content',
  description: 'The message body. A div; for a user\'s message it is the bubble. While the message streams, the last one shows a caret after the last paragraph, list item, heading or non-empty table cell when it ends with one, or after its text when it holds only text.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The text, often a Prose.Root with rendered markdown.',
    },
  ],
} as const satisfies ComponentMeta;
