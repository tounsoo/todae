import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'themeOverrideStyle',
  description:
    'themeOverrideStyle(overrides, overrideTypes) returns the public --todae-* custom properties ThemeProvider sets for overrides, as a style object such as { "--todae-color-fg-default": "oklch(0.2 0 0)" }. An unknown key or a value of the wrong type throws in development and is skipped in production.',
  props: [
    {
      name: 'overrides',
      type: 'ThemeOverride',
      required: true,
      description: 'Token paths and typed values, as ThemeProvider takes them. null or undefined gives {}.',
    },
    {
      name: 'overrideTypes',
      type: 'ThemeOverrideTypes',
      required: false,
      description: "Types for a company's own token paths, as ThemeProvider takes them.",
    },
  ],
} as const satisfies ComponentMeta;
