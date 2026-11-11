import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'StringsProvider',
  description:
    'Sets the text Todae writes by itself, such as default accessible names and Field.Counter messages, for its subtree. Renders no element; useStrings() reads the strings in effect.',
  props: [
    {
      name: 'strings',
      type: 'Partial<Strings>',
      required: true,
      description:
        'The strings to change. Each key left out comes from the nearest StringsProvider above, else English. A component prop such as aria-label still wins.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Subtree that uses these strings.',
    },
  ],
} as const satisfies ComponentMeta;
