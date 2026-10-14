import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Steps.Root',
  description:
    'An ordered list of steps, such as an agent\'s plan or a checklist, as an ol with role="list". Name it with aria-label or aria-labelledby when the page has more than one. Takes native ol attributes.',
  props: [],
} as const satisfies ComponentMeta;
