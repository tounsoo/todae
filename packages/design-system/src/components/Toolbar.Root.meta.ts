import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Toolbar.Root',
  description:
    'role="toolbar" with one tab stop. Arrow keys, Home and End move focus between the focusable controls inside, wrappers included. Takes native div attributes.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the toolbar. Pass this or aria-labelledby.',
    },
    {
      name: 'orientation',
      type: '"horizontal" | "vertical"',
      required: false,
      default: '"horizontal"',
      description: 'Left and Right move focus in a horizontal toolbar, Up and Down in a vertical one. Left and Right follow the text direction.',
    },
    {
      name: 'loop',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Wrap from the last control to the first and back.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Buttons, toggles, menu triggers and other controls, with Toolbar.Group and Toolbar.Separator between them.',
    },
  ],
} as const satisfies ComponentMeta;
