import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Conversation.Content',
  description:
    'Holds the messages, spaced by conversation.gap. When an article in it takes aria-busy="true", as Message.Root does while streaming, Conversation announces that a message is arriving; when that clears, that it finished, unless the message holds a role="alert". Takes native div attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Message.Root elements.',
    },
  ],
} as const satisfies ComponentMeta;
