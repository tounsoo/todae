import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useAppearance',
  description:
    "useAppearance() returns light or dark: the nearest ThemeProvider's appearance, with system resolved through prefers-color-scheme. It is light outside any ThemeProvider and when rendered on the server.",
  props: [],
} as const satisfies ComponentMeta;
