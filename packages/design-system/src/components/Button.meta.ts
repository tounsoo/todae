import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button',
  description: 'Native button with a variant.',
  props: [
    {
      name: 'variant',
      type: '"primary" | "secondary"',
      required: false,
      default: '"primary"',
      description: 'Visual style.',
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
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Button label.',
    },
  ],
} as const satisfies ComponentMeta;
