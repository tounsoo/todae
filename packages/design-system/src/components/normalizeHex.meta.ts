import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'normalizeHex',
  description:
    'normalizeHex(text) returns #rrggbb in lower case for a three- or six-digit hex color, with or without #, and null for anything else.',
  props: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The text to read, such as typed input. Spaces around it are ignored.',
    },
  ],
} as const satisfies ComponentMeta;
