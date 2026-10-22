import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Splitter.Root',
  description:
    'Two resizable panels and the handle between them, in the order Splitter.Panel, Splitter.Handle, Splitter.Panel; more panes nest roots. `value` is the size in CSS pixels of the primary panel, the first one unless `primary` is `end`; the other takes the rest. A vertical splitter needs a definite block size. Takes native div attributes.',
  props: [
    {
      name: 'orientation',
      type: '"horizontal" | "vertical"',
      required: false,
      default: '"horizontal"',
      description: 'The axis the panels are laid along. A horizontal splitter puts them side by side.',
    },
    {
      name: 'primary',
      type: '"start" | "end"',
      required: false,
      default: '"start"',
      description: 'Which panel `value` sizes. The other panel takes the rest.',
    },
    {
      name: 'value',
      type: 'number',
      required: false,
      description: 'The primary panel\'s size in CSS pixels, when you own it.',
    },
    {
      name: 'defaultValue',
      type: 'number',
      required: false,
      description: 'The primary panel\'s starting size in CSS pixels. Starts at 240, within `min` and `max`, without one.',
    },
    {
      name: 'onValueChange',
      type: '(value: number) => void',
      required: false,
      description: 'Called on every change of the size, from a drag or a key, with the new size.',
    },
    {
      name: 'min',
      type: 'number',
      required: false,
      default: '0',
      description: 'The smallest size in pixels while the panel is open. A container too narrow for it wins.',
    },
    {
      name: 'max',
      type: 'number',
      required: false,
      description: 'The largest size in pixels. The container limits it too.',
    },
    {
      name: 'step',
      type: 'number',
      required: false,
      default: '16',
      description: 'Pixels an arrow key moves the handle.',
    },
    {
      name: 'collapsible',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Lets the primary panel collapse to 0: Enter toggles it, and a drag below half of `min` snaps to 0.',
    },
    {
      name: 'show',
      type: '"both" | "start" | "end"',
      required: false,
      default: '"both"',
      description:
        'Which panels show. "start" or "end" shows that panel alone, across the whole root, and takes the other panel and the handle out of the layout with `display: none`. Both panels stay mounted, and the size is kept for when both show again.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Splitter.Panel, Splitter.Handle and Splitter.Panel.',
    },
  ],
} as const satisfies ComponentMeta;
