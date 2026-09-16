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
      description: 'Resolved to light or dark before writing data-appearance. Never writes system.',
    },
    {
      name: 'overrides',
      type: 'ThemeOverride',
      required: false,
      description:
        'Allowlisted appearance color roles only. Values are typed OKLCH; unknown keys and raw CSS are rejected.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Themed subtree.',
    },
  ],
} as const satisfies ComponentMeta;
