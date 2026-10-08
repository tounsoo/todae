import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'paginationRange',
  description:
    'Returns the pages to show as numbers, with "start-ellipsis" and "end-ellipsis" for the gaps. While there are more pages than slots the list keeps one length, and a gap always stands for two or more pages.',
  props: [
    {
      name: 'page',
      type: 'number',
      required: true,
      description: 'The current page, from 1. Clamped to 1..count.',
    },
    {
      name: 'count',
      type: 'number',
      required: true,
      description: 'How many pages there are. Below 1 gives an empty list.',
    },
    {
      name: 'siblings',
      type: 'number',
      required: false,
      default: '1',
      description: 'Pages shown on each side of the current one.',
    },
    {
      name: 'boundaries',
      type: 'number',
      required: false,
      default: '1',
      description: 'Pages always shown at each end.',
    },
  ],
} as const satisfies ComponentMeta;
