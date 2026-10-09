import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Breadcrumbs.Root',
  description: 'A nav landmark with an ordered list of the pages above this one. Takes native nav attributes.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Breadcrumb"',
      description: 'Landmark name. Default is the breadcrumbs string from StringsProvider; the server entry always uses English.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of an element that names the landmark. When set, the default name is dropped.',
    },
    {
      name: 'separator',
      type: 'string',
      required: false,
      default: '"/"',
      description: 'Text drawn between items. Screen readers skip it.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Breadcrumbs.Item elements, from the top page down to this one.',
    },
  ],
} as const satisfies ComponentMeta;
