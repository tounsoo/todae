import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.ChipInput',
  description: 'Controlled chips plus input inside Field.Root. Commit does not mutate chips. maxRows uses model B.',
  props: [
    {
      name: 'chips',
      type: 'string[]',
      required: true,
      description: 'Controlled chip labels.',
    },
    {
      name: 'inputValue',
      type: 'string',
      required: true,
      description: 'Controlled input text.',
    },
    {
      name: 'onInputValueChange',
      type: '(value: string) => void',
      required: true,
      description: 'Input text changes.',
    },
    {
      name: 'onCommit',
      type: '(value: string) => void',
      required: true,
      description: 'Fires on a commit key with a trimmed non-empty value. Does not append chips.',
    },
    {
      name: 'onChipRemove',
      type: '(index: number, value: string) => void',
      required: true,
      description: 'Dismiss click or Backspace on an empty input.',
    },
    {
      name: 'commitKeys',
      type: 'ReadonlyArray<"Enter" | "Tab" | "," | ";" | " ">',
      required: false,
      default: '["Enter"]',
      description: 'Closed allowlist of commit keys.',
    },
    {
      name: 'maxRows',
      type: 'number',
      required: false,
      description:
        'Caps visual rows of chips plus input. Newest chips fold into +N. The last visible chip ellipsizes to soak leftover width before +N.',
    },
    {
      name: 'removeOnBackspace',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Backspace on an empty input removes the last chip.',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Native placeholder.',
    },
  ],
} as const satisfies ComponentMeta;
