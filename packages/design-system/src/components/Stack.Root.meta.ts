import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Stack.Root',
  description: 'Flex layout. Each gap step but none reads a contract token: stack.gap-condensed, stack.gap or stack.gap-spacious.',
  props: [
    {
      name: 'direction',
      type: '"row" | "column"',
      required: false,
      default: '"column"',
      description: 'Flex direction.',
    },
    {
      name: 'gap',
      type: '"none" | "condensed" | "normal" | "spacious"',
      required: false,
      default: '"normal"',
      description:
        'Space between items. `condensed`, `normal` and `spacious` follow the density; `none` is no space.',
    },
    {
      name: 'wrap',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Lets items wrap onto more lines.',
    },
    {
      name: 'align',
      type: '"start" | "center" | "end" | "baseline" | "stretch"',
      required: false,
      description: 'Cross-axis alignment. Omitted, items stretch.',
    },
    {
      name: 'justify',
      type: '"start" | "center" | "end" | "between"',
      required: false,
      description: 'Main-axis distribution. Omitted, items pack at the start.',
    },
    {
      name: 'as',
      type: '"div" | "ul" | "ol" | "nav" | "section" | "header" | "footer"',
      required: false,
      default: '"div"',
      description:
        'The element to render. A `ul` or `ol` loses its bullets and indent and keeps `role="list"`.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Laid-out children.',
    },
  ],
} as const satisfies ComponentMeta;
