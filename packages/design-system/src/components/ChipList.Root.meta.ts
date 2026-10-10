import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ChipList.Root',
  description:
    'A list of chips that folds the ones past maxRows into a +N button, which opens a popover with the rest. Name it with aria-label or aria-labelledby.',
  props: [
    {
      name: 'chips',
      type: 'readonly string[]',
      required: true,
      description: 'Chip labels, in order.',
    },
    {
      name: 'maxRows',
      type: 'number',
      required: false,
      description: 'Rows to show before folding the rest into +N. Without it, every chip wraps onto as many rows as it needs.',
    },
    {
      name: 'getKey',
      type: '(value: string, index: number) => string',
      required: false,
      description:
        'A stable, unique key for each chip, so focus can follow it when chips change. Without it, chips are matched by value, so focus can land on another chip with the same value.',
    },
    {
      name: 'getTone',
      type: '(value: string, index: number) => ChipTone',
      required: false,
      description: 'Each chip\'s tone, such as (value) => categoryTone(value). Without it, every chip is neutral.',
    },
    {
      name: 'onRemove',
      type: '(index: number, value: string) => void',
      required: false,
      description:
        'Renders a remove button on each chip. Once chips drops the focused chip, focus moves to the chip that now fills its place, else the one before it, else +N, else the list.',
    },
    {
      name: 'removeLabel',
      type: '(value: string) => string',
      required: false,
      description: 'Remove button name. Default is the removeChip string from StringsProvider, Remove {value} in English.',
    },
    {
      name: 'removeIcon',
      type: 'React.ReactNode',
      required: false,
      description: "Remove button content, such as an icon from your own set. Without it, the close glyph from GlyphsProvider, else Todae's cross.",
    },
    {
      name: 'overflowLabel',
      type: '(n: number) => string',
      required: false,
      description: '+N button name. Default is the moreChips string from StringsProvider, {n} more in English.',
    },
    {
      name: 'panelLabel',
      type: '(n: number) => string',
      required: false,
      description: 'Name of the popover with the folded chips. Default is the moreChipsPanel string from StringsProvider, {n} more chips or 1 more chip in English.',
    },
  ],
} as const satisfies ComponentMeta;
