import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'themeColorCss',
  description: 'themeColorCss(value) returns a ThemeColorValue as a CSS oklch() color, with / alpha only when alpha is set and not 1.',
  props: [
    {
      name: 'value',
      type: 'ThemeColorValue',
      required: true,
      description: 'An oklch color, as parseThemeColor returns.',
    },
  ],
} as const satisfies ComponentMeta;
