import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'EmptyState.Root',
  description: "What a list, table or search shows when it has nothing. A div with no role, so it is not announced when it appears; takes native div attributes.",
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'EmptyState parts, or any content.',
    },
  ],
} as const satisfies ComponentMeta;
