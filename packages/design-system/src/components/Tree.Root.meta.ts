import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Tree.Root',
  description:
    'A role="tree" list with one tab stop. Up and Down move between the items shown, Right and Left open, close and move in and out, Home and End go to the ends, and typing finds an item.',
  props: [
    {
      name: 'value',
      type: 'string | null',
      required: false,
      description: 'Controlled selected item. null selects none. Pass with onValueChange.',
    },
    {
      name: 'defaultValue',
      type: 'string | null',
      required: false,
      description: 'Initial selected item when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description:
        'Fires with the item a click, Enter or Space selects. A tree given none of value, defaultValue and onValueChange has no selection.',
    },
    {
      name: 'expanded',
      type: 'string[]',
      required: false,
      description: 'Controlled open items. Pass with onExpandedChange.',
    },
    {
      name: 'defaultExpanded',
      type: 'string[]',
      required: false,
      description: 'Initial open items when uncontrolled.',
    },
    {
      name: 'onExpandedChange',
      type: '(expanded: string[]) => void',
      required: false,
      description: 'Fires with the open items after an item opens or closes.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Tree.Item children.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the tree.',
    },
  ],
} as const satisfies ComponentMeta;
