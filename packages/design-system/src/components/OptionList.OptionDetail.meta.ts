import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'OptionList.OptionDetail',
  description: 'Second line under an option title. The option describes itself with this line.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Detail text, announced as the option description.',
    },
  ],
} as const satisfies ComponentMeta;
