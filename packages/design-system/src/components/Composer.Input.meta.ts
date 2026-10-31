import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Composer.Input',
  description:
    'The textarea of a composer, with optional mention suggestions and a peek while the caret rests in a token. Enter while the suggestion list is open picks a mention and does not send. Enter with the list closed sends through Composer.Root.',
  props: [
    {
      name: 'mentions',
      type: 'readonly MentionSource[]',
      required: false,
      description: 'Mention sources. Each one is also a useMentions trigger, and renderPeek fills the caret peek.',
    },
    {
      name: 'value',
      type: 'MentionDraft',
      required: false,
      description: 'Controlled draft, the text and its tokens together.',
    },
    {
      name: 'defaultValue',
      type: 'MentionDraft',
      required: false,
      description: 'Starting draft when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: MentionDraft) => void',
      required: false,
      description: 'Called with the next text and its tokens on every edit, including a pick.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the field. One of aria-label or aria-labelledby is required.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Ids of the elements that name the field. One of aria-label or aria-labelledby is required.',
    },
  ],
} as const satisfies ComponentMeta;
