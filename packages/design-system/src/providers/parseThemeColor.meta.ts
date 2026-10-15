import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseThemeColor',
  description:
    'parseThemeColor(text) returns an oklch ThemeColorValue for a color such as #3366cc, converted to oklch, or oklch(0.5 0.1 30 / 0.8). It returns null for text it does not read, such as oklch(50% 0.1 30), and for a color out of range, such as a lightness above 1.',
  props: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The text to read. Spaces around it are ignored.',
    },
  ],
} as const satisfies ComponentMeta;
