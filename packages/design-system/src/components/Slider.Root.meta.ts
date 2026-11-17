import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Slider.Root',
  description: 'A native range input tinted from the slider tokens. With mode="range", two thumbs on one track. Takes native input attributes except type.',
  props: [
    {
      name: 'mode',
      type: "'single' | 'range'",
      required: false,
      default: "'single'",
      description: 'One thumb, or "range" for two thumbs on one track. A thumb stops when it meets the other.',
    },
    {
      name: 'min',
      type: 'number | string',
      required: false,
      default: '0',
      description: 'The lowest value.',
    },
    {
      name: 'max',
      type: 'number | string',
      required: false,
      default: '100',
      description: 'The highest value.',
    },
    {
      name: 'step',
      type: 'number | string',
      required: false,
      default: '1',
      description: 'How far one arrow key moves the value.',
    },
    {
      name: 'value',
      type: 'number | string | readonly [number, number]',
      required: false,
      description: 'The value, with onChange. With mode="range", the start and the end, with onValueChange.',
    },
    {
      name: 'defaultValue',
      type: 'number | string | readonly [number, number]',
      required: false,
      description: 'The starting value, when the slider keeps it. With mode="range", the starting pair.',
    },
    {
      name: 'onValueChange',
      type: '(value: [number, number]) => void',
      required: false,
      description: 'With mode="range", called with the next start and end after a gesture.',
    },
    {
      name: 'startLabel',
      type: 'string',
      required: false,
      description: 'With mode="range", the accessible name of the start thumb.',
    },
    {
      name: 'endLabel',
      type: 'string',
      required: false,
      description: 'With mode="range", the accessible name of the end thumb.',
    },
    {
      name: 'name',
      type: 'string | readonly [string, string]',
      required: false,
      description: 'The field name. With mode="range", the start field name and the end field name. Omit it and neither range input submits.',
    },
    {
      name: 'aria-valuetext',
      type: 'string',
      required: false,
      description: 'What a screen reader says instead of the number, such as "40%" or "Medium".',
    },
  ],
} as const satisfies ComponentMeta;
