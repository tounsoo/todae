import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'themeOverrideType',
  description: "themeOverrideType(key) returns the $type of one of Todae's ThemeProvider override keys, such as color or dimension.",
  props: [
    {
      name: 'key',
      type: 'ThemeOverrideKey',
      required: true,
      description: 'A key from THEME_OVERRIDE_KEYS.',
    },
  ],
} as const satisfies ComponentMeta;
