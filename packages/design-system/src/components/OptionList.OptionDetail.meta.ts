import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList.OptionDetail',
  description: 'Second line under an option title. The option is named by its title, then this line.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Detail text, read in the option name after the title.',
    },
  ],
} as const satisfies ComponentMeta;
