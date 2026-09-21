import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList.Option',
  kind: 'part',
  description: 'String-only option. Same as the top-level Option export.',
  whenToUse: [
    'String-only option. Same as the top-level Option export.',
  ],
  whenNotToUse: [
    'Text children only.',
  ],
  intents: [
    'choose-one',
    'choose-many',
  ],
  related: [
    { id: 'OptionList', relation: 'partOf' },
    { id: 'Option', relation: 'alternative' },
  ],
  docs: '/optionlist',
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
