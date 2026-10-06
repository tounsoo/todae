import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tabs.Root',
  description: 'Owns the selected tab. Takes value with onValueChange, or defaultValue.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: false,
      description: 'Controlled selected tab. Pass with onValueChange.',
    },
    {
      name: 'defaultValue',
      type: 'string',
      required: false,
      description: 'Initial selected tab when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Fires with the next selected tab.',
    },
    {
      name: 'orientation',
      type: '"horizontal" | "vertical"',
      required: false,
      default: '"horizontal"',
      description: 'Arrow keys, layout and aria-orientation.',
    },
    {
      name: 'activation',
      type: '"automatic" | "manual"',
      required: false,
      default: '"automatic"',
      description: 'automatic selects on focus. manual waits for Enter, Space or a click.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tabs.List and Tabs.Panel.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the root.',
    },
  ],
} as const satisfies ComponentMeta;
