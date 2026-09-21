import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList',
  kind: 'component',
  description:
    'Overlay listbox. Single or multiple. Use Radio or Checkbox for a permanent choice on the page.',
  whenToUse: [
    'Overlay listbox. Keep it inside a Popover or BottomSheet.',
    'A combobox can pass id, activeValue, onActiveChange, and tabIndex={-1} so the input owns focus.',
  ],
  whenNotToUse: [
    'Use Radio when one choice stays on the page.',
    'Use Checkbox when several independent choices stay on the page.',
    'Do not wire OptionList and Radio or Checkbox to the same value.',
  ],
  intents: [
    'choose-one',
    'choose-many',
    'search-select',
  ],
  slots: [
    { name: 'children', accepts: [
      'Option',
      'OptionList.Option',
    ], required: true, description: 'String options.' },
  ],
  related: [
    { id: 'Radio', relation: 'alternative' },
    { id: 'Checkbox', relation: 'alternative' },
    { id: 'Option', relation: 'requires' },
  ],
  docs: '/optionlist',
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
      name: 'id',
      type: 'string',
      required: false,
      description: 'Listbox id. Auto-generated when omitted. Option ids derive from it.',
    },
    {
      name: 'tabIndex',
      type: 'number',
      required: false,
      default: '0',
      description: 'Listbox tabIndex. Pass -1 when a combobox input owns focus.',
    },
    {
      name: 'activeValue',
      type: 'string | null',
      required: false,
      description: 'Controlled highlighted value. Omit to keep highlight inside the list.',
    },
    {
      name: 'onActiveChange',
      type: '(value: string | null) => void',
      required: false,
      description: 'Fires when keyboard or pointer moves the highlight.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Name when no visible label is present.',
    },
  ],
} as const satisfies ComponentMeta;
