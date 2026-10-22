import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Splitter.Handle',
  description:
    'The `separator` between the panels, one Tab stop. Arrow keys move it by `step` in the direction they point, Home and End go to the smallest and largest size, and Enter collapses a collapsible panel or restores it. A drag with the pointer resizes too. Takes native div attributes.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Resize"',
      description:
        'Names the handle with text. Pass this or aria-labelledby. Default is the resizePanel string from StringsProvider.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: "The id of the element that names the handle, such as the primary panel's heading.",
    },
  ],
} as const satisfies ComponentMeta;
