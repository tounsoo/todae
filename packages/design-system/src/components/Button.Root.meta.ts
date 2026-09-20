import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button.Root',
  description: 'Native button. Owns variant, type, and disabled. Default type is button.',
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
