import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useSelection',
  description:
    'useSelection(options) returns { value, isSelected, state, toggle, toggleAll, clear, getCheckboxProps, getSelectAllProps }. value is the selected keys in the order they were selected. state is "none", "some" or "all" over the enabled keys in keys, and "none" when there are none. getCheckboxProps(key, props?) returns { checked, disabled, onChange } and getSelectAllProps(props?) returns { checked, indeterminate, disabled, onChange }, to spread on Checkbox.Root. Shift held on a checkbox sets every enabled key between the last toggled key and it to its new state.',
  props: [
    {
      name: 'keys',
      type: 'readonly K[]',
      required: true,
      description: 'The keys that can be selected now, in display order, such as the rows on the current page. Selected keys outside this list, such as those on other pages, are kept. K is a string or a number.',
    },
    {
      name: 'disabledKeys',
      type: 'readonly K[]',
      required: false,
      description: 'Keys that cannot be selected: ranges and select all skip them, and their checkbox is disabled.',
    },
    {
      name: 'value',
      type: 'readonly K[]',
      required: false,
      description:
        "Controlled selection, in the order keys were selected. Defined means controlled. A change you don't take by the end of the task that made it, such as one you set in a transition, is dropped from the next change.",
    },
    {
      name: 'defaultValue',
      type: 'readonly K[]',
      required: false,
      description: 'Initial selection when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: K[]) => void',
      required: false,
      description: 'Fires with the new selection after it changes.',
    },
  ],
} as const satisfies ComponentMeta;
