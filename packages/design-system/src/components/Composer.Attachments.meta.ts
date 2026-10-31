import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Composer.Attachments',
  description: 'The row above the input that holds Attachment.Root items.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The attachments, usually a labelled list of Attachment.Root.',
    },
  ],
} as const satisfies ComponentMeta;
