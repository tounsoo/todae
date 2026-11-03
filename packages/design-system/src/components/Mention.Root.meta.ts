import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Mention.Root',
  description:
    'A mention in sent text. A link when source.href returns a string, otherwise a button. Hover, focus, or click opens a Popover filled only by source.renderPeek.',
  props: [
    {
      name: 'source',
      type: 'MentionSource',
      required: true,
      description: 'The source that resolves this mention and renders its peek.',
    },
    {
      name: 'id',
      type: 'string',
      required: true,
      description: 'The token value, passed to source.resolve and source.href.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The mention text, such as @Mina Park.',
    },
  ],
} as const satisfies ComponentMeta;
