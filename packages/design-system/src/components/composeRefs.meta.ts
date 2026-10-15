import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'composeRefs',
  description:
    "composeRefs(...refs) returns one callback ref that sets every given ref, such as your own ref and the one a hook's prop getter returns. It returns a new callback on each call.",
  props: [
    {
      name: '...refs',
      type: '(React.Ref<T> | undefined)[]',
      required: true,
      description: 'Object refs, callback refs or undefined.',
    },
  ],
} as const satisfies ComponentMeta;
