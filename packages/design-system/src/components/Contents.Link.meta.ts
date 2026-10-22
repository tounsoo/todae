import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Contents.Link',
  description: 'A link to a section of the page by its href fragment. Renders an a, or a router link through render; takes native a attributes.',
  props: [
    {
      name: 'href',
      type: 'string',
      required: false,
      description: 'The fragment of the section, such as #props. A link to another page is never marked current.',
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
      description: 'Set by Contents.Root to location on the link to the section being read. A value you pass wins.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The link text, usually the heading of the section.',
    },
  ],
} as const satisfies ComponentMeta;
