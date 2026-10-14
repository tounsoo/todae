import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Content',
  description: 'The message body. A div; for a user\'s message it is the bubble. While the message streams, a caret follows the last paragraph, list item, heading or table cell when the content ends with one, or plain text with no blocks in it.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The text, often a Prose.Root with rendered markdown.',
    },
  ],
} as const satisfies ComponentMeta;
