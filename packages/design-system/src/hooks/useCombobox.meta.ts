import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useCombobox',
  description:
    'Headless combobox state. Spread getters onto Field, Button, Popover, BottomSheet, Dialog, and OptionList. No Combobox chrome.',
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
      description:
        'Async options. Stale responses are discarded. An inline function is fine; it is read at call time.',
    },
    {
      name: 'loadKey',
      type: 'string | number',
      required: false,
      description:
        'Reloads options when it changes. Use it when loadOptions depends on state outside the query, such as a category.',
    },
    {
      name: 'presentation',
      type: '"popover" | "sheet" | "dialog" | "auto"',
      required: false,
      default: '"auto"',
      description: 'auto uses useSheetPresentation. dialog is for Dialog.Root, through getDialogProps.',
    },
    {
      name: 'allowCreate',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Show a create row when the query has no case-insensitive label match. With loadOptions, the row waits until the load for that query settles.',
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
