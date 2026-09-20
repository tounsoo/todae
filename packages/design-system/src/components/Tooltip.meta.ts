import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip',
  description:
    'Tip surface only. Wire it with useTooltip getTooltipProps. Default is role=tooltip text. interactive is a non-modal tip dialog and allows links.',
  props: [
    {
      name: 'id',
      type: 'string',
      required: true,
      description: 'Surface id. Spread from getTooltipProps.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: true,
      description: 'Open state. Spread from getTooltipProps.',
    },
    {
      name: 'interactive',
      type: 'boolean',
      required: false,
      default: 'false',
      description:
        'Use the non-modal tip dialog. Links only. Never role=tooltip. Exactly one of aria-label or aria-labelledby.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description:
        'Accessible name when no visible caption exists. Exactly one of aria-label or aria-labelledby when interactive.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of the visible caption. Exactly one of aria-label or aria-labelledby when interactive.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tooltip text, or short prose plus links when interactive.',
    },
  ],
} as const satisfies ComponentMeta;
