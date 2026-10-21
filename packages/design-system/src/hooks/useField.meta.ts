import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useField',
  description:
    "Joins a custom control to the nearest Field.Root. Spread getControlProps on the control. For a control that is not a native form element, render an input with getValueInputProps({ type, value, required, min, max, step, bound }): a hidden native input that submits the value under the field's name and that the browser validates, so required, min and max block a submit and Form.Root shows them and moves focus to the control. getValueInputProps takes a type of text, number, date, time, datetime-local or color, the value in that type's format, and a bound that words a min or max in the field's own format. Takes no options.",
  props: [],
} as const satisfies ComponentMeta;
