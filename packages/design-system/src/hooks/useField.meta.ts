import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useField',
  description:
    "Joins a custom control to the nearest Field.Root. Spread getControlProps on the control. For a control that is not a native form element, render an input with getValueInputProps({ type, value, required, min, max, step, bound }) after getControlProps: a hidden native input that submits the value under the field's name and that the browser validates, so required, min and max block a submit and Form.Root shows them and moves focus to the control. It follows the control's disabled and form, and takes no name when that control sent one. getValueInputProps takes a type of text, number, date, time or datetime-local, the value in that type's format, and a bound that gives a min or max as the field shows it. Takes no options.",
  props: [],
} as const satisfies ComponentMeta;
