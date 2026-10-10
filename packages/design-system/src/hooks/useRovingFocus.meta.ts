import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useRovingFocus',
  description:
    'One tab stop for a composite. Spread getContainerProps on the group and getItemProps(value) on each item.',
  props: [
    {
      name: 'orientation',
      type: '"horizontal" | "vertical" | "both"',
      required: false,
      default: '"vertical"',
      description: 'Which arrow keys move focus. Left and Right swap in a right-to-left container.',
    },
    {
      name: 'loop',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Wrap from the last item to the first and back.',
    },
    {
      name: 'typeahead',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Typing focuses the next item whose text starts with the typed characters.',
    },
    {
      name: 'tabStop',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Keep one item tabbable. False when focus only enters from code, as in a menu: every item gets tabIndex -1.',
    },
    {
      name: 'findItems',
      type: '(container: HTMLElement) => HTMLElement[]',
      required: false,
      description: 'Finds the items, enabled or not, instead of getItemProps. Such items have no value, so no tab stop is kept: the hook only moves focus.',
    },
    {
      name: 'activeValue',
      type: 'string | null',
      required: false,
      description: 'Controlled tab stop. Falls back to the first enabled item when null, disabled or missing.',
    },
    {
      name: 'defaultActiveValue',
      type: 'string | null',
      required: false,
      description: 'Initial tab stop when uncontrolled.',
    },
    {
      name: 'onActiveValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Fires when an item other than activeValue takes focus, including a fallback tab stop, so a controlled owner can pin it.',
    },
    {
      name: 'tree',
      type: 'boolean',
      required: false,
      default: 'false',
      description:
        'Tree view keys. Up and Down skip items inside an item with aria-expanded="false" and do not wrap. Right opens a closed item or moves into an open one; Left closes an open item or moves to its parent. orientation and loop are ignored.',
    },
    {
      name: 'onExpandedChange',
      type: '(value: string, expanded: boolean) => void',
      required: false,
      description: 'In tree mode, fires when Right asks to open a closed item or Left asks to close an open one.',
    },
  ],
} as const satisfies ComponentMeta;
