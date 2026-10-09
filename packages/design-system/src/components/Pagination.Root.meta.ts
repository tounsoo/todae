import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Pagination.Root',
  description:
    'A nav landmark around an ordered list of pages. Named by the pagination string from StringsProvider ("Pagination" in English; always English in the server entry) unless a non-empty aria-label or aria-labelledby is passed. Takes native nav attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Pagination.Item and Pagination.Ellipsis parts, often from paginationRange.',
    },
  ],
} as const satisfies ComponentMeta;
