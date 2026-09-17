import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useChipField',
  description: 'Optional state helper. ChipField stays fully controlled without it.',
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
