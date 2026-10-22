import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useInlineEdit',
  description:
    'useInlineEdit({ value, onCommit, onCancel }) returns { editing, draft, setDraft, start, commit, cancel, getTriggerProps, getGroupProps, getInputProps }. Spread getTriggerProps on the button that starts the edit, getGroupProps on the element that holds the input and its buttons while editing, and getInputProps on the text input. start() opens the edit from value, focuses the input and selects its text. Enter and focus leaving the group commit, and Escape and a modal\'s close requests cancel; keys that end an IME composition are left to the input. A press on a button in the group keeps focus in the input. When the edit closes with focus inside it, focus returns to the trigger.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'The saved value. Each edit starts from it.',
    },
    {
      name: 'onCommit',
      type: '(draft: string) => boolean | void',
      required: true,
      description:
        'Called with the draft when the person saves: Enter, a Save button that calls commit, or focus leaving the edit. Return false to keep editing, such as for an empty name; when focus left the edit, false puts the value back and calls onCancel. Not called when the draft equals value; the edit just closes.',
    },
    {
      name: 'onCancel',
      type: '() => void',
      required: false,
      description: 'Called when the person cancels: Escape, or a Cancel button that calls cancel.',
    },
  ],
} as const satisfies ComponentMeta;
