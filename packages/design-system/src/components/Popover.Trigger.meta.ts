import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Popover.Trigger',
  description: 'Button.Root that toggles the popover and owns the CSS anchor.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Button label.',
    },
  ],
} as const satisfies ComponentMeta;
