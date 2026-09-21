import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Icon',
  kind: 'part',
  description: 'Order-only icon. Decorative unless interactive. No side prop.',
  whenToUse: [
    'Order-only icon inside Field.Root. Decorative unless interactive. No side prop.',
  ],
  whenNotToUse: [
    'Not a free-floating atom. Do not treat Field.Icon as a public Icon export.',
  ],
  intents: [
    'text-entry',
    'tag-entry',
  ],
  related: [
    { id: 'Field.Root', relation: 'partOf' },
  ],
  docs: '/field',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon or control.',
    },
    {
      name: 'interactive',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'When false, the wrapper is aria-hidden.',
    },
  ],
} as const satisfies ComponentMeta;
