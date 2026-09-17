import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList',
  description: 'Listbox. Single or multiple. Option children are strings. Does not close a Popover.',
  props: [
    {
      name: 'selectionMode',
      type: '"single" | "multiple"',
      required: false,
      default: '"single"',
      description: 'Single fires onChange(string). Multiple fires onChange(string[]).',
    },
    {
      name: 'value',
      type: 'string | null | readonly string[]',
      required: true,
      description: 'Selected value, or values when selectionMode is multiple.',
    },
    {
      name: 'onChange',
      type: '(value: string | string[]) => void',
      required: true,
      description: 'Selection change. Single passes a string. Multiple passes the next array.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Name when no visible label is present.',
    },
  ],
} as const satisfies ComponentMeta;
