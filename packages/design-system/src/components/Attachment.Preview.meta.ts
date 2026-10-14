import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Attachment.Preview',
  description:
    'A box of attachment.preview.size beside the name. An img or video, or the img in a picture, covers it and is cropped to it; an svg icon takes attachment.icon.size. Takes native div attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A thumbnail, such as an img with alt="", or an icon of the file type.',
    },
  ],
} as const satisfies ComponentMeta;
