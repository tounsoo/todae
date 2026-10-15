import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'themeValueCss',
  description: "themeValueCss(key, value) returns an override value as the CSS ThemeProvider writes for that key's type.",
  props: [
    {
      name: 'key',
      type: 'ThemeOverrideKey',
      required: true,
      description: 'A key from THEME_OVERRIDE_KEYS.',
    },
    {
      name: 'value',
      type: 'ThemeOverrideValue',
      required: true,
      description: "A value of the key's type. A value of another type gives an empty string.",
    },
  ],
} as const satisfies ComponentMeta;
