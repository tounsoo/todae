import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drilldown.Viewport',
  description:
    'div that holds the views. During a slide it stacks the leaving and entering views in one grid cell, clips them, animates its height and sets data-direction to forward or back.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Drilldown.View elements.',
    },
  ],
} as const satisfies ComponentMeta;
