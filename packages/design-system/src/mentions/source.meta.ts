import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'defineMentionSource',
  description:
    'Returns the source unchanged. In development, warns when char is not a single character. Pass the same object to useMentions and MentionText.',
  props: [
    {
      name: 'source',
      type: 'MentionSource',
      required: true,
      description:
        'A useMentions trigger plus resolve, renderPeek, peekLabel, and href. renderPeek(entity, { id, mode, close }) is the only content of the peek.',
    },
  ],
} as const satisfies ComponentMeta;
