import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Body',
  description: 'Scroll container. Drag starts only at scrollTop 0. While its content overflows it takes a tab stop, so the keyboard can scroll it.',
  props: [],
} as const satisfies ComponentMeta;
