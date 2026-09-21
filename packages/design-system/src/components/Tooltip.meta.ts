import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip',
  kind: 'component',
  description: 'Tip chrome. Spread getTooltipProps for wire.',
  whenToUse: [
    'Tip chrome. Spread getTooltipProps. Default is text-only role=tooltip.',
  ],
  whenNotToUse: [
    'There is no Tooltip.Trigger or Tooltip.Content.',
    'Do not set interactive on Tooltip. Pass interactive to useTooltip.',
  ],
  intents: [
    'transient-hint',
  ],
  related: [
    { id: 'useTooltip', relation: 'pairsWith' },
  ],
  docs: '/tooltip',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tooltip text, or short prose plus links when interactive.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Class name for the tip surface.',
    },
    {
      name: 'style',
      type: 'React.CSSProperties',
      required: false,
      description: 'Style for the tip surface. Anchor position comes from getTooltipProps.',
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
  ],
} as const satisfies ComponentMeta;
