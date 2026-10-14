import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Attachment.Progress',
  description:
    'A Progress.Root under the name, for an upload. It is named by Attachment.Name unless it has an aria-label or aria-labelledby. Takes native progress attributes.',
  props: [
    {
      name: 'value',
      type: 'number',
      required: false,
      description: 'How far the upload has come, out of max. Leave it out when the end is unknown.',
    },
  ],
} as const satisfies ComponentMeta;
