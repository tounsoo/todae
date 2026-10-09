import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Meter.Root',
  description: 'A native meter drawn as a track and a fill from the progress and meter tokens. Takes native meter attributes.',
  props: [
    {
      name: 'value',
      type: 'number',
      required: true,
      description: 'The measurement, between min and max.',
    },
    {
      name: 'min',
      type: 'number',
      required: false,
      default: '0',
      description: 'The low end of the range.',
    },
    {
      name: 'max',
      type: 'number',
      required: false,
      default: '1',
      description: 'The high end of the range.',
    },
    {
      name: 'low',
      type: 'number',
      required: false,
      description: 'Where the low part of the range ends.',
    },
    {
      name: 'high',
      type: 'number',
      required: false,
      description: 'Where the high part of the range starts.',
    },
    {
      name: 'optimum',
      type: 'number',
      required: false,
      description: 'The best value. With low and high it decides whether the fill is meter.fill.optimum, meter.fill.suboptimum or meter.fill.critical.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the meter when no label element points at it.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The value as text, for browsers that do not draw the meter.',
    },
  ],
} as const satisfies ComponentMeta;
