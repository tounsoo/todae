import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Contents.Root',
  description: 'A nav landmark holding a list of links to the sections of the page. It marks the link to the section being read with aria-current="location". Takes native nav attributes.',
  props: [
    {
      name: 'label',
      type: 'React.ReactNode',
      required: false,
      description: 'Text shown above the list, which also names the landmark.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Landmark name when there is no label or aria-labelledby. Default is the contents string from StringsProvider.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Contents.Item elements.',
    },
  ],
} as const satisfies ComponentMeta;
