import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Spinner.Root',
  description: 'A native progress with no value, drawn from the spinner tokens as a turning ring or a wave through three dots. Takes native progress attributes except value and max.',
  props: [
    {
      name: 'variant',
      type: '"ring" | "dots"',
      required: false,
      default: '"ring"',
      description: 'ring turns one arc of a circle; dots sends a wave through three dots, as a typing indicator does. Sets data-variant.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the spinner when it is not inside a label with text. It keeps the progressbar role, so it needs a name.',
    },
  ],
} as const satisfies ComponentMeta;
