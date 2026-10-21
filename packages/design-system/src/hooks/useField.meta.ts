import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useField',
  description:
    "Joins a custom control to the nearest Field.Root. Spread getControlProps on the control. For a control that is not a native form element, render an input with getValueInputProps({ type, value, name, required, min, max, step, bound }, control) beside it, passing the props getControlProps returned: a hidden native input that submits the value under the field's name and that the browser validates, so required, min and max block a submit and Form.Root shows them and moves focus to the control. It follows the control's disabled and form, and takes no name when that control has one. getValueInputProps takes a type of text, number, date, time or datetime-local, the value in that type's format, and a bound that gives a min or max as the field shows it. Call notifyValueChange when a person changes the value in a way that fires no change event, such as a pick: it hides the field's server error and counts the field as edited. useField() takes no arguments.",
  props: [],
} as const satisfies ComponentMeta;
