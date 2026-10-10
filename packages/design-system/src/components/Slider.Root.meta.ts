import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Slider.Root',
  description: 'A native range input tinted from the slider tokens. Takes native input attributes except type.',
  props: [
    {
      name: 'min',
      type: 'number',
      required: false,
      default: '0',
      description: 'The lowest value.',
    },
    {
      name: 'max',
      type: 'number',
      required: false,
      default: '100',
      description: 'The highest value.',
    },
    {
      name: 'step',
      type: 'number',
      required: false,
      default: '1',
      description: 'How far one arrow key moves the value.',
    },
    {
      name: 'value',
      type: 'number',
      required: false,
      description: 'The value, with onChange. Use defaultValue to leave it to the input.',
    },
    {
      name: 'aria-valuetext',
      type: 'string',
      required: false,
      description: 'What a screen reader says instead of the number, such as "40%" or "Medium".',
    },
  ],
} as const satisfies ComponentMeta;
