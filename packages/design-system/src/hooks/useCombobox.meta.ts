import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useCombobox',
  kind: 'hook',
  description:
    'Headless combobox state. Spread getters onto Field, Button, Popover, BottomSheet, and OptionList. No Combobox chrome.',
  whenToUse: [
    'Headless combobox state. Spread getters onto Field, Button, Popover, BottomSheet, and OptionList.',
    'presentation auto uses useSheetPresentation.',
  ],
  whenNotToUse: [
    'No Combobox chrome. Do not export Combobox.Root, Combobox.Trigger, or Combobox.Icon.',
    'Do not dual-wire aria or open outside the hook while also using it.',
  ],
  intents: [
    'search-select',
    'choose-one',
    'choose-many',
    'tag-entry',
  ],
  related: [
    { id: 'OptionList', relation: 'requires' },
    { id: 'useSheetPresentation', relation: 'pairsWith' },
  ],
  docs: '/combobox',
  props: [
    {
      name: 'selectionMode',
      type: '"single" | "multiple"',
      required: false,
      default: '"single"',
      description: 'Single uses TextInput. Multiple uses ChipInput.',
    },
    {
      name: 'options',
      type: 'readonly ComboboxOption[]',
      required: false,
      description: 'Sync options. Ignored when loadOptions is set.',
    },
    {
      name: 'loadOptions',
      type: '(query: string, signal: AbortSignal) => Promise<readonly ComboboxOption[]>',
      required: false,
      description: 'Async options. Stale responses are discarded.',
    },
    {
      name: 'presentation',
      type: '"popover" | "sheet" | "auto"',
      required: false,
      default: '"auto"',
      description: 'auto uses useSheetPresentation.',
    },
    {
      name: 'allowCreate',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Show a create row when the query has no case-insensitive label match.',
    },
    {
      name: 'value',
      type: 'string | null | readonly string[]',
      required: false,
      description: 'Controlled value. Null for empty single. Array for multiple.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open.',
    },
    {
      name: 'inputValue',
      type: 'string',
      required: false,
      description: 'Controlled filter text.',
    },
  ],
} as const satisfies ComponentMeta;
