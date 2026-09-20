import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tooltip',
  description:
    'One public Tooltip. Default is role=tooltip text. interactive is a non-modal tip dialog and allows links.',
  props: [
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
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      description: 'Initial open state when uncontrolled.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: TooltipOpenReason) => void',
      required: false,
      description: 'Fires after a commit. Leaving open unchanged is a veto.',
    },
    {
      name: 'showDelay',
      type: 'number',
      required: false,
      default: '300',
      description: 'Hover show delay in milliseconds. Focus shows at once.',
    },
    {
      name: 'hideDelay',
      type: 'number',
      required: false,
      default: '100',
      description: 'Hide delay in milliseconds.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'Tooltip.Trigger and Tooltip.Content.',
    },
  ],
} as const satisfies ComponentMeta;
