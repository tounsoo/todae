import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Avatar.Root',
  description:
    'A span that shows an image, or a fallback while it loads, when it fails or when there is none. Named by label as one image (role="img"); without label it is hidden from assistive technology. It draws at --todae-avatar-size-md, which a product sets on the avatar or around it. Takes native span attributes except role, aria-label and aria-labelledby.',
  props: [
    {
      name: 'label',
      type: 'string',
      required: false,
      description: 'Names the avatar, whichever of the image and the fallback shows. Leave it out when the name is written next to the avatar.',
    },
    {
      name: 'tone',
      type: '"neutral" | "category-1" | "category-2" | "category-3" | "category-4" | "category-5" | "category-6" | "category-7" | "category-8"',
      required: false,
      default: '"neutral"',
      description: 'Colors behind the fallback. neutral reads avatar.bg and avatar.fg; other tones read the avatar.<tone> contract tokens. categoryTone(id) picks a stable category per person.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Avatar.Image and Avatar.Fallback.',
    },
  ],
} as const satisfies ComponentMeta;
