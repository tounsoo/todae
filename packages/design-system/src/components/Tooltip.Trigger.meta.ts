import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip.Trigger',
  description: 'Hit target wrap. Sets CSS anchor-name. Describes the first tabbable child, or itself.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'A single element. Disabled children let the wrap take pointer and keyboard.',
    },
  ],
} as const satisfies ComponentMeta;
