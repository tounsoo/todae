import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Prose.Root',
  description:
    'A div that styles the headings, paragraphs, lists and block quotes of rendered markdown inside it, and spaces its children. An element of any other kind, such as a div, table or pre, stops the styles from reaching what it holds; takes native div attributes.',
  props: [],
} as const satisfies ComponentMeta;
