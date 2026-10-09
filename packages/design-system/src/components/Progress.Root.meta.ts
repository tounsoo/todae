import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Progress.Root',
  description: 'A native progress drawn as a track and a fill from the progress tokens. Takes native progress attributes.',
  props: [
    {
      name: 'value',
      type: 'number',
      required: false,
      description: 'How far the task has come, from 0 to max. Leave it out when the end is unknown: a band sweeps the track.',
    },
    {
      name: 'max',
      type: 'number',
      required: false,
      default: '1',
      description: 'The value at which the task is done.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the bar when no label element points at it. Every progress bar needs a name.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The value as text, for browsers that do not draw the bar.',
    },
  ],
} as const satisfies ComponentMeta;
