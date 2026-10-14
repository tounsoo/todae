import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Attachment.Root',
  description:
    'One file in a composer or a message, as a div with role="group" named by Attachment.Name unless it has an aria-label or aria-labelledby. The upload is product code: status shows its state. Takes native div attributes.',
  props: [
    {
      name: 'status',
      type: '"ready" | "uploading" | "error"',
      required: false,
      default: '"ready"',
      description: 'Sets data-status. An error takes the attachment.border.error and attachment.meta.fg.error tokens.',
    },
  ],
} as const satisfies ComponentMeta;
