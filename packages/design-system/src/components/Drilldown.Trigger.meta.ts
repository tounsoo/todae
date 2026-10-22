import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drilldown.Trigger',
  description:
    'Button.Root that pushes its value onto the stack. Takes Button.Root\'s props, such as variant and render, so it can be a Next button or a row.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'The Drilldown.View to push. Focus returns to this trigger when that view is popped.',
    },
    {
      name: 'variant',
      type: 'ButtonVariant',
      required: false,
      default: '"primary"',
      description: 'Button variant.',
    },
    {
      name: 'render',
      type: '(props: ButtonRenderProps) => ReactElement',
      required: false,
      description: 'Draws the trigger on another element, such as a row or a link, as Button.Root does.',
    },
    {
      name: 'onClick',
      type: 'React.MouseEventHandler<HTMLElement>',
      required: false,
      description: 'Runs before the push. Call event.preventDefault() to stay on this view.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Trigger content.',
    },
  ],
} as const satisfies ComponentMeta;
