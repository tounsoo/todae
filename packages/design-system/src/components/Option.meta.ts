import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Option',
  kind: 'component',
  description: 'String-only option. Also available as OptionList.Option.',
  whenToUse: [
    'String-only option. Also available as OptionList.Option.',
  ],
  whenNotToUse: [
    'Text children only. Do not nest interactive controls inside Option.',
  ],
  intents: [
    'choose-one',
    'choose-many',
  ],
  related: [
    { id: 'OptionList', relation: 'partOf' },
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
