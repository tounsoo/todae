import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button.Root',
  kind: 'component',
  description: 'Native button. Owns variant, type, and disabled. Default type is button.',
  whenToUse: [
    'Primary actions. Icon-only roots need aria-label or aria-labelledby. Default type is button.',
  ],
  whenNotToUse: [
    'Do not nest Button.Root inside Field.Root as a second role. Fitting labeled buttons do not tip.',
  ],
  intents: [
    'action',
  ],
  slots: [
    { name: 'children', accepts: [
      'Button.Icon',
    ], required: false, description: 'Label text and optional Button.Icon in DOM order.' },
  ],
  related: [
    { id: 'Button.Icon', relation: 'requires' },
    { id: 'ButtonGroup', relation: 'pairsWith' },
  ],
  docs: '/button',
  props: [
    {
      name: 'variant',
      type: '"primary" | "secondary" | "ghost"',
      required: false,
      default: '"primary"',
      description: 'Visual style. Non-primary sets data-button-variant.',
    },
    {
      name: 'type',
      type: '"button" | "submit" | "reset"',
      required: false,
      default: '"button"',
      description: 'Native button type.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables the control.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Required accessible name when the only child is Button.Icon. Auto-tip text for icon-only.',
    },
    {
      name: 'tooltip',
      type: 'boolean',
      required: false,
      default: 'true',
      description:
        'Icon-only tips the accessible name. Overflowing labels tip the full string. False opts out. Never tips a fitting labeled button.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Label and optional Button.Icon. Order is leading or trailing.',
    },
  ],
} as const satisfies ComponentMeta;
