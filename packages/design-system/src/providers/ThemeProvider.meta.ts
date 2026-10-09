import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ThemeProvider',
  description: 'Sets data-appearance from system, light, or dark. Nested providers override.',
  props: [
    {
      name: 'appearance',
      type: '"system" | "light" | "dark"',
      required: false,
      default: '"system"',
      description: 'Written to data-appearance as is. system follows prefers-color-scheme in CSS.',
    },
    {
      name: 'overrides',
      type: 'ThemeOverride',
      required: false,
      description:
        'Closed allowlist of raw, semantic, and component token paths, plus any keys in overrideTypes. Values are typed; unknown keys and raw CSS are rejected.',
    },
    {
      name: 'overrideTypes',
      type: 'ThemeOverrideTypes',
      required: false,
      description:
        "Types for a company's own token paths, from the THEME_OVERRIDE_TYPES module that todae-tokens build writes. Adds those paths to the overrides allowlist.",
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Themed subtree.',
    },
  ],
} as const satisfies ComponentMeta;
