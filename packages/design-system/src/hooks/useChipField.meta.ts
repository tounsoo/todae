import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useChipField',
  kind: 'hook',
  description: 'Optional state helper. Field.ChipInput stays fully controlled without it.',
  whenToUse: [
    'Optional state helper. Holds chips and input, then spreads onto Field.ChipInput.',
  ],
  whenNotToUse: [
    'Field.ChipInput stays fully controlled without it.',
  ],
  intents: [
    'tag-entry',
  ],
  related: [
    { id: 'Field.ChipInput', relation: 'pairsWith' },
  ],
  docs: '/field',
  props: [
    {
      name: 'initialChips',
      type: 'string[]',
      required: false,
      default: '[]',
      description: 'Starting chips.',
    },
    {
      name: 'initialInputValue',
      type: 'string',
      required: false,
      default: '""',
      description: 'Starting input text.',
    },
    {
      name: 'dedupe',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Skip commits that already exist.',
    },
    {
      name: 'transform',
      type: '(raw: string) => string | null',
      required: false,
      description: 'Normalize a commit. Null rejects. Default trims and rejects empty.',
    },
  ],
} as const satisfies ComponentMeta;
