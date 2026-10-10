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
      description: 'Remove button click or Backspace on an empty input.',
    },
    {
      name: 'chipRemoveLabel',
      type: '(value: string) => string',
      required: false,
      description: 'Remove button name. Default is the removeChip string from StringsProvider, Remove {value} in English.',
    },
    {
      name: 'chipRemoveIcon',
      type: 'React.ReactNode',
      required: false,
      description: "Chip remove button content, such as an icon from your own set. Without it, the close glyph from GlyphsProvider, else Todae's cross.",
    },
    {
      name: 'overflowLabel',
      type: '(n: number) => string',
      required: false,
      description: '+N name. Default is the moreChips string from StringsProvider, {n} more in English.',
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
        'Caps visual rows. inline: chips plus input. row: chip lines only; the input keeps its own line. Newest chips fold into +N. A chip that does not fit at full width moves into +N. Only a chip wider than the row truncates.',
    },
    {
      name: 'chipLayout',
      type: '"inline" | "row"',
      required: false,
      default: '"inline"',
      description:
        'inline: chips flow beside the input. row: chips sit in a full-width line above the input, inside the ChipInput; Icon and Affix sit on the first line; no chips renders a one-line field the height of TextInput.',
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
