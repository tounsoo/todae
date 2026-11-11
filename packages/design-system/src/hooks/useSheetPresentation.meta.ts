import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useSheetPresentation',
  description:
    'Coarse pointer or narrow width selects sheet. SSR and first paint are popover. isSheet mirrors presentation.',
  props: [
    {
      name: 'narrowWidth',
      type: 'number',
      required: false,
      default: '640',
      description: 'Viewport width that starts the narrow media query. Media is max-width: n - 1.',
    },
    {
      name: 'coarseQuery',
      type: 'string',
      required: false,
      default: "'(pointer: coarse)'",
      description: 'matchMedia query treated as coarse pointer.',
    },
    {
      name: 'forced',
      type: '"popover" | "sheet" | "auto"',
      required: false,
      default: '"auto"',
      description: 'Skip media when popover or sheet. auto uses coarse OR narrow.',
    },
  ],
} as const satisfies ComponentMeta;
