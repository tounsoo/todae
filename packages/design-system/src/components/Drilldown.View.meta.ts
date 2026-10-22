import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drilldown.View',
  description:
    'div with role="group", named by its label. Mounted while its value is in the stack; a view lower in the stack is hidden, and a leaving view is inert and aria-hidden until its slide ends.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'The value Drilldown.Trigger pushes and the stack holds.',
    },
    {
      name: 'label',
      type: 'string',
      required: true,
      description: 'Names the view\'s group, Drilldown.Label while it shows, and Drilldown.Back from the view above it.',
    },
    {
      name: 'initialFocusRef',
      type: 'RefObject<HTMLElement | null>',
      required: false,
      description: 'Where focus goes when the view shows with nothing remembered for it: on a push, or the first time a controlled change shows it. Without it, the first tab stop in the view, or the view itself.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The view\'s content.',
    },
  ],
} as const satisfies ComponentMeta;
