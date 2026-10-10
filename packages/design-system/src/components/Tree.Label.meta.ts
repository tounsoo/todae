import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tree.Label',
  description:
    "The item's row and its name. Draws the chevron, from GlyphsProvider when one is set. A click selects the item and opens or closes a branch.",
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The item text, with an optional Tree.Icon before it.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the row.',
    },
  ],
} as const satisfies ComponentMeta;
