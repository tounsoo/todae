import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseThemeValue',
  description:
    "parseThemeValue(key, text) reads text as a ThemeProvider override value of the key's type, such as 1.5rem for a dimension or 200ms for a duration, or returns null for text it does not read, such as 16px for a dimension.",
  props: [
    {
      name: 'key',
      type: 'ThemeOverrideKey',
      required: true,
      description: 'A key from THEME_OVERRIDE_KEYS. Its type decides how the text is read.',
    },
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The text to read. Spaces around it are ignored.',
    },
  ],
} as const satisfies ComponentMeta;
