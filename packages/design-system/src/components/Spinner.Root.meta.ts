import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Spinner.Root',
  description: 'A native progress with no value, drawn as a turning ring from the spinner tokens. Takes native progress attributes except value and max.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the spinner when it is not inside a label with text. It keeps the progressbar role, so it needs a name.',
    },
  ],
} as const satisfies ComponentMeta;
