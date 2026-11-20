import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList.Option',
  description: 'Option inside OptionList.Root. The title is the name. OptionList.OptionDetail is the description.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Selection value.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'Title. A string, plus one OptionList.OptionDetail for a second line.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Skips pointer and keyboard selection. Use aria-disabled instead of disabled for an option that is unavailable for now but stays reachable.',
    },
  ],
} as const satisfies ComponentMeta;
