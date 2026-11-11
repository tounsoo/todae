import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Trigger',
  description:
    'Button.Root wired as the menu button: aria-haspopup="menu", aria-expanded, ArrowDown and ArrowUp open.',
  props: [
    {
      name: 'variant',
      type: 'ButtonVariant',
      required: false,
      default: '"primary"',
      description: 'Button variant.',
    },
    {
      name: 'tooltip',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Button tooltip. Off by default on a menu trigger.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Trigger label.',
    },
  ],
} as const satisfies ComponentMeta;
