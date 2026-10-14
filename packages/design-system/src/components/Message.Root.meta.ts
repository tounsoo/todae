import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Root',
  description: 'A turn of a conversation, as an article from the message tokens. from sets the layout: a user\'s message sits at the end side in a bubble, a system message is a quiet centered line. Takes native article attributes.',
  props: [
    {
      name: 'from',
      type: '"user" | "assistant" | "system"',
      required: false,
      default: '"assistant"',
      description: 'Who wrote the message. Sets data-from, which sets layout and tokens only.',
    },
    {
      name: 'streaming',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'True while the message is still arriving. Sets aria-busy and data-streaming, and Message.Content draws a caret after the text. Set it back to false when the message finishes or fails.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Message parts: Avatar, Header, Content and Actions.',
    },
  ],
} as const satisfies ComponentMeta;
