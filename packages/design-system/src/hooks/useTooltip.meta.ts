import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useTooltip',
  description:
    'One open machine. Spread getTriggerProps onto the trigger and getTooltipProps onto Tooltip. Interactive is a non-modal tip dialog.',
  props: [
    {
      name: 'interactive',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Use the non-modal tip dialog. Links only. Never role=tooltip.',
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
      default: 'tooltip.delay.show (300ms)',
      description: "Hover show delay in milliseconds. Without it, the tooltip.delay.show token as the trigger computes it. Focus shows at once.",
    },
    {
      name: 'hideDelay',
      type: 'number',
      required: false,
      default: 'tooltip.delay.hide (100ms)',
      description: 'Hide delay in milliseconds. Without it, the tooltip.delay.hide token as the trigger computes it.',
    },
    {
      name: 'enabled',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'False resets intent and commits close.',
    },
    {
      name: 'id',
      type: 'string',
      required: false,
      description: 'Tooltip id. Default is a generated id.',
    },
  ],
} as const satisfies ComponentMeta;
