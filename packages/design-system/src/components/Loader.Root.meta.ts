import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Loader.Root',
  description: 'A native progress with no value, drawn from the loader tokens as a spinner or a wave through three dots. Takes native progress attributes except value and max.',
  props: [
    {
      name: 'variant',
      type: '"spinner" | "dots"',
      required: false,
      default: '"spinner"',
      description: 'spinner turns one arc of a ring; dots sends a wave through three dots, as a typing indicator does. Sets data-variant.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the indicator when it is not inside a label with text. It keeps the progressbar role, so it needs a name.',
    },
  ],
} as const satisfies ComponentMeta;
