import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useTooltip',
  kind: 'hook',
  description:
    'One open machine. Spread getTriggerProps onto the trigger and getTooltipProps onto Tooltip. Interactive is a non-modal tip dialog.',
  whenToUse: [
    'Open machine for Tooltip. Spread getTriggerProps on the trigger and getTooltipProps on Tooltip.',
    'Pass interactive: true for a non-modal tip dialog with links. Never role=tooltip in that mode.',
  ],
  whenNotToUse: [
    'Set tooltip={false} on Button.Root when this hook owns the machine.',
  ],
  intents: [
    'transient-hint',
  ],
  related: [
    { id: 'Tooltip', relation: 'pairsWith' },
  ],
  docs: '/tooltip',
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
