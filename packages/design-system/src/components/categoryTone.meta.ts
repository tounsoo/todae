import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'categoryTone',
  description:
    'categoryTone(key) returns one of category-1 to category-8 for a string, such as a user id or a tag name. The same key gets the same tone on the server and in every browser.',
  props: [
    {
      name: 'key',
      type: 'string',
      required: true,
      description: 'A stable key. Composed and decomposed forms of the same text get the same tone.',
    },
  ],
} as const satisfies ComponentMeta;
