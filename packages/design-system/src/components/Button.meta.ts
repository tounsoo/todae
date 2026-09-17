import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button',
  description: 'Native button styled through the button contract tokens.',
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
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Button label.',
    },
  ],
} as const satisfies ComponentMeta;
