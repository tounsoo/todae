import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'EmptyState.Title',
  description: 'The empty state\'s heading, at the level `as` names. An `h2` by default.',
  props: [
    {
      name: 'as',
      type: '"h2" | "h3" | "h4" | "h5" | "h6" | "p"',
      required: false,
      default: '"h2"',
      description: 'The rendered element. Pick the heading level that fits the page, or p to keep the title out of the outline.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
