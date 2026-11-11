import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ToggleGroup.Item',
  description: 'A secondary Button.Root with aria-pressed from the group. Takes Button.Root props except the pressed ones.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Identifies the item in the group value.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables this item.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Label, or a Button.Icon with aria-label.',
    },
  ],
} as const satisfies ComponentMeta;
