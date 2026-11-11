import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drilldown.Label',
  description:
    'span with the shown view\'s label. Put it in Dialog.Title, Drawer.Title or BottomSheet.Title, so the overlay\'s title and name follow the view.',
  props: [],
} as const satisfies ComponentMeta;
