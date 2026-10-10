import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Kbd.Root',
  description: 'A native kbd drawn as a key cap from the kbd tokens. One with keys or samp inside stays plain text. Takes native kbd attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A key name, or for a shortcut one Kbd.Root per key.',
    },
  ],
} as const satisfies ComponentMeta;
