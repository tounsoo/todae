import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useFocusHandoff',
  description:
    'useFocusHandoff({ to }) returns a ref for an element that can unmount while it holds focus, such as buttons that go away once they are used. When it unmounts with focus inside, focus moves to to once the commit is done, unless something else took focus by then or to is gone too. A click on a control inside focuses that control first, since Safari and Firefox on macOS do not focus a clicked button.',
  props: [
    {
      name: 'to',
      type: 'RefObject<HTMLElement | null>',
      required: true,
      description: 'The element that takes focus when the watched element unmounts while it holds focus.',
    },
  ],
} as const satisfies ComponentMeta;
