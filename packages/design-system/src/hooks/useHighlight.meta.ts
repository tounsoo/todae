import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useHighlight',
  description:
    'Returns { ref, matches }. Put ref on the element to search. matches holds a live Range per match of query, in document order, and is empty on the server. Ranges paint through CSS.highlights under name, so nothing is added to the DOM; style them with ::highlight(name). The hook searches again when text, elements or the hidden, class, style or open attributes under ref change.',
  props: [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Name to style with ::highlight(name). Give each hook its own name.',
    },
    {
      name: 'query',
      type: 'string | readonly string[]',
      required: false,
      description: 'Text to find inside the element on ref. A list finds every term; empty strings are skipped.',
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Match letter case exactly.',
    },
    {
      name: 'ranges',
      type: 'readonly AbstractRange[]',
      required: false,
      description: 'More ranges to paint, such as the current match. They need no ref and are not added to matches.',
    },
    {
      name: 'priority',
      type: 'number',
      required: false,
      default: '0',
      description: 'Which highlight paints on top where two overlap. Higher wins.',
    },
    {
      name: 'type',
      type: "'highlight' | 'spelling-error' | 'grammar-error'",
      required: false,
      default: "'highlight'",
      description: 'Highlight type, for spelling and grammar marks.',
    },
  ],
} as const satisfies ComponentMeta;
