import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useField',
  description:
    'Joins a custom control to the nearest Field.Root. Spread getControlProps on the control. Takes no options.',
  props: [],
} as const satisfies ComponentMeta;
