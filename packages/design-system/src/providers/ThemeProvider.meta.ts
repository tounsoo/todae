import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ThemeProvider',
  kind: 'provider',
  description: 'Sets data-appearance from system, light, or dark. Nested providers override.',
  whenToUse: [
    'Sets data-appearance from system, light, or dark. Nested providers override.',
  ],
  whenNotToUse: [
    'Never writes data-appearance=system. The resolved value is light or dark.',
  ],
  intents: [
    'theme',
  ],
  related: [
    { id: 'DensityProvider', relation: 'pairsWith' },
  ],
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
        'Closed allowlist of raw, semantic, and component token paths. Values are typed; unknown keys and raw CSS are rejected.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Themed subtree.',
    },
  ],
} as const satisfies ComponentMeta;
