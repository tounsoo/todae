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
      name: 'onRemove',
      type: '(index: number, value: string) => void',
      required: false,
      description: 'Renders a remove button on each chip. Focus moves to the chip that takes its place.',
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
      description: 'Name of the popover with the folded chips. Default is {n} more.',
    },
  ],
} as const satisfies ComponentMeta;
