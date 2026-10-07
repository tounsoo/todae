import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ToggleGroup.Root',
  description:
    'role="group" of toggle buttons with one tab stop and arrow-key focus. Inside a Toolbar, the toolbar owns the arrow keys. Takes native div attributes.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the group, such as "Alignment".',
    },
    {
      name: 'selectionMode',
      type: '"single" | "multiple"',
      required: false,
      default: '"single"',
      description: 'Single presses one item at most; pressing it again clears it. Multiple presses any number.',
    },
    {
      name: 'value',
      type: 'string | null | readonly string[]',
      required: false,
      description: 'Controlled pressed value: a value or null for single, an array for multiple.',
    },
    {
      name: 'defaultValue',
      type: 'string | null | readonly string[]',
      required: false,
      description: 'Starting pressed value when uncontrolled.',
    },
    {
      name: 'onChange',
      type: '(value: string | null) => void | (value: string[]) => void',
      required: false,
      description: 'Called with the new pressed value when an item is pressed.',
    },
    {
      name: 'orientation',
      type: '"horizontal" | "vertical"',
      required: false,
      default: '"horizontal", or the toolbar\'s',
      description: 'Arrow keys that move focus. Horizontal items join like Button.Group.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables every item.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'ToggleGroup.Item elements.',
    },
  ],
} as const satisfies ComponentMeta;
