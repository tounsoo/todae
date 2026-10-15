import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseThemeColor',
  description:
    'parseThemeColor(text) returns an oklch ThemeColorValue for a six-digit #rrggbb color or an oklch() color, converting hex to oklch, or null for anything else.',
  props: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The text to read. Spaces around it are ignored.',
    },
  ],
} as const satisfies ComponentMeta;
