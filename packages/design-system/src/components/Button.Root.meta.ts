import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button.Root',
  description: 'Native button, or an a through render. Owns variant, type, and disabled. Default type is button. aria-disabled="true" draws it disabled and keeps it focusable; a toggle then does not flip.',
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
      name: 'pressed',
      type: 'boolean',
      required: false,
      description: 'Controlled pressed state. Makes the button a toggle with aria-pressed.',
    },
    {
      name: 'defaultPressed',
      type: 'boolean',
      required: false,
      description: 'Starting pressed state for an uncontrolled toggle. Makes the button a toggle with aria-pressed.',
    },
    {
      name: 'onPressedChange',
      type: '(pressed: boolean) => void',
      required: false,
      description: 'Called with the new state when a toggle is clicked. onClick runs first; preventDefault() there skips the change.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Label and optional Button.Icon. Order is leading or trailing.',
    },
    {
      name: 'render',
      type: '(props: ButtonRenderProps) => React.ReactElement',
      required: false,
      description:
        'Draws the button on another element, such as an a or a router link. It receives every prop, ref included, and must pass them to an a or a button. The element keeps its own role, so type, disabled and pressed are not allowed; an a without href looks disabled.',
    },
  ],
} as const satisfies ComponentMeta;
