import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'MentionText',
  description:
    'Renders a mention draft. A token whose character matches a source becomes Mention.Root. Any other token, and the text around them, stays plain text.',
  props: [
    {
      name: 'value',
      type: 'MentionDraft',
      required: true,
      description: 'The text and its tokens.',
    },
    {
      name: 'sources',
      type: 'readonly MentionSource[]',
      required: true,
      description: 'Sources used to turn matching tokens into Mention.Root.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Class on the wrapping span.',
    },
  ],
} as const satisfies ComponentMeta;
