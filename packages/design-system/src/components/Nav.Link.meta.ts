import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Nav.Link',
  description: 'A link drawn as a nav row. Renders an a, or a router link through render; takes native a attributes.',
  props: [
    {
      name: 'href',
      type: 'string',
      required: false,
      description: 'Where the link goes.',
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
      description: 'Marks the link to the page you are on, which draws it as the current row.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The link text, with an optional icon before it.',
    },
  ],
} as const satisfies ComponentMeta;
