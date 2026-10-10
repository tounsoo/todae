import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Link.Root',
  description: 'A link styled from the link tokens. Renders an a, or a router link through render; takes native a attributes.',
  props: [
    {
      name: 'href',
      type: 'string',
      required: false,
      description: 'Where the link goes. Without it the element is not a link and gets no link style.',
    },
    {
      name: 'render',
      type: '(props: React.ComponentPropsWithRef<"a">) => React.ReactElement',
      required: false,
      description: 'Renders something other than a plain a, such as a router link. It receives every prop, the class name included, and must pass them to an a.',
    },
    {
      name: 'aria-current',
      type: '"page" | "step" | "location" | "date" | "time" | "true" | "false"',
      required: false,
      description: 'Marks the link to the current page or step; its underline thickens.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The link text.',
    },
  ],
} as const satisfies ComponentMeta;
