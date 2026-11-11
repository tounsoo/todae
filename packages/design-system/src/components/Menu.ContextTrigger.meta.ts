import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.ContextTrigger',
  description:
    'A region whose right click, long press on Android, Shift+F10 or ContextMenu key opens the menu: at the pointer, or below the focused element from the keyboard. Renders a div unless render returns another element.',
  props: [
    {
      name: 'render',
      type: '(props: MenuContextTriggerRenderProps) => ReactElement',
      required: false,
      description:
        'Renders the region as another element, such as a table row or a list item. It receives every prop, ref included, and must pass them on.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The content a context request opens the menu from.',
    },
  ],
} as const satisfies ComponentMeta;
