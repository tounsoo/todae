import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DataList.Root',
  description:
    'A native dl for key and value pairs, such as a settings pane, an order summary or a profile. Takes native dl attributes; orientation sets whether each term sits beside its details or above them.',
  props: [
    {
      name: 'orientation',
      type: '"horizontal" | "vertical"',
      required: false,
      default: '"horizontal"',
      description:
        'Sets data-orientation. Horizontal puts each term in a column beside its details, and stacks them when the list is too narrow for both. Vertical always puts the term above its details.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'DataList.Item parts.',
    },
  ],
} as const satisfies ComponentMeta;
