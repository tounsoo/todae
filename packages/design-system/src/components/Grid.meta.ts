import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Grid',
  description:
    'CSS grid layout, the two-axis partner to Stack. Gap comes from the grid.gap contract token. Pass at most one of columns or minItemSize; with neither, set gridTemplateColumns yourself.',
  props: [
    {
      name: 'columns',
      type: 'number',
      required: false,
      description: 'A fixed number of equal columns, a whole number from 1.',
    },
    {
      name: 'minItemSize',
      type: 'string',
      required: false,
      description: 'The narrowest a column may get, as a CSS length such as "12rem". As many columns fit as the width allows.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Laid-out children.',
    },
  ],
} as const satisfies ComponentMeta;
