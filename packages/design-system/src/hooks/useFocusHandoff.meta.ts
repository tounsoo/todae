import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useFocusHandoff',
  description:
    'useFocusHandoff({ to }) returns a ref callback for an element that can unmount while it holds focus. When that element unmounts with focus inside it, focus moves to the element in to once the commit is done, unless focus is already on another element in the page or to is not in the page.',
  props: [
    {
      name: 'to',
      type: 'RefObject<HTMLElement | null>',
      required: true,
      description: 'The element that takes focus when the watched element unmounts while it holds focus.',
    },
  ],
} as const satisfies ComponentMeta;
