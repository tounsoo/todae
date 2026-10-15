import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseThemeColor',
  description:
    'parseThemeColor(text) returns an oklch ThemeColorValue for a six-digit #rrggbb color, converting it to oklch, or for an oklch() color that is a valid ThemeColorValue, and null for anything else.',
  props: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The text to read. Spaces around it are ignored.',
    },
  ],
} as const satisfies ComponentMeta;
