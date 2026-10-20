import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList.Option',
  description: 'String-only option inside OptionList.Root.',
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
      description: 'Skips pointer and keyboard selection. Use aria-disabled instead of disabled for an option that is unavailable for now but stays reachable.',
    },
  ],
} as const satisfies ComponentMeta;
