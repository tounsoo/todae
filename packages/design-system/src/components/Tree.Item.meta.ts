import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tree.Item',
  description:
    'A role="treeitem" list item, named by its Tree.Label. With a Tree.Group inside, it opens and closes, and aria-expanded says which.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Names the item for selection and for expanded. Unique in the tree.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description:
        "Can't be selected. Still takes focus, so a screen reader announces it as unavailable, and still opens and closes.",
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A Tree.Label, then a Tree.Group for a branch.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the item.',
    },
  ],
} as const satisfies ComponentMeta;
