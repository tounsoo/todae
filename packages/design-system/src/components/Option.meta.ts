import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Option',
  description: 'String-only option. Also available as OptionList.Option.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Selection value.',
    },
    {
      name: 'children',
      type: 'string',
      required: true,
      description: 'Visible label. Text only.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Skips pointer and keyboard selection.',
    },
  ],
} as const satisfies ComponentMeta;
