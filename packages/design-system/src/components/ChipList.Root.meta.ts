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
      name: 'onRemove',
      type: '(index: number, value: string) => void',
      required: false,
      description:
        'Renders a remove button on each chip. Once chips drops the focused chip, focus moves to the chip that now fills its place, else the one before it, else +N, else the list.',
    },
    {
      name: 'dismissLabel',
      type: '(value: string) => string',
      required: false,
      description: 'Remove button name. Default is Remove {value}.',
    },
    {
      name: 'overflowLabel',
      type: '(n: number) => string',
      required: false,
      description: '+N button name. Default is {n} more.',
    },
    {
      name: 'panelLabel',
      type: '(n: number) => string',
      required: false,
      description: 'Name of the popover with the folded chips. Default is {n} more chips, or 1 more chip.',
    },
  ],
} as const satisfies ComponentMeta;
