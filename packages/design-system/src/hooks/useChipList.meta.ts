import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useChipList',
  description:
    'Returns { listRef, measureRef, visible, hidden, measured }. visible is a prefix of chips. hidden is the +N count, capped at chips.length; 0 when maxRows is unset. measured is false on the server and before the first layout pass. Put listRef on the wrapping list (its width and gap drive the fold). The measure row on measureRef must be inert and aria-hidden and contain every chip, then a "…" probe chip, then a Chip.Root holding +{chips.length || 1}.',
  props: [
    {
      name: 'chips',
      type: 'readonly string[]',
      required: true,
      description: 'Chip labels, in order. visible is always a prefix.',
    },
    {
      name: 'maxRows',
      type: 'number',
      required: false,
      description: 'Fold chips that do not fit into +N. Unset shows every chip.',
    },
    {
      name: 'reserveWidth',
      type: 'RefObject<HTMLElement | null>',
      required: false,
      description: 'Element whose computed min-width stays free on the last line. A ref so density changes stay current.',
    },
  ],
} as const satisfies ComponentMeta;
