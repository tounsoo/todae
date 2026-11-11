import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ScrollArea.Root',
  description:
    'A div that scrolls and keeps the focus rings of what it holds whole: its children sit in a content box padded by a ring\'s room, and it scroll-pads by the same. Takes native div attributes.',
  props: [
    {
      name: 'axis',
      type: "'block' | 'inline' | 'both'",
      required: false,
      default: "'block'",
      description: 'The direction it scrolls in. The other direction is clipped.',
    },
    {
      name: 'focusable',
      type: 'boolean',
      required: false,
      description:
        'Whether it takes a Tab stop, so a keyboard can scroll it, while its content overflows. Without it, only when nothing inside can take focus. Name it with aria-label or aria-labelledby when it can take one.',
    },
    {
      name: 'arrows',
      type: 'boolean',
      required: false,
      default: 'false',
      description:
        'Whether an arrow shows at each edge where its content is cut off, while there is more to scroll that way. Resting a mouse or pen on one scrolls toward it. The arrows are for the pointer only: touch and keys scroll as before, and assistive technology never meets them.',
    },
  ],
} as const satisfies ComponentMeta;
