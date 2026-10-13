import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ColorPicker.Area',
  description:
    'Saturation left to right and brightness bottom to top, over the current hue. Two native range inputs carry the values: Left and Right change saturation, Up and Down brightness, Shift moves ten steps, and only the saturation input is a Tab stop. Takes div attributes except children.',
  props: [],
} as const satisfies ComponentMeta;
