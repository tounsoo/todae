import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useLaneDragState',
  description:
    'useLaneDragState(drag, select) returns select of the drag under way from useLaneDrag, or of null when there is none, and renders again only when that selection changes. A lane that selects the drag while its place is in that lane renders each time the place in it changes, not on every pointer move, and not while the drag is in other lanes.',
  props: [
    {
      name: 'drag',
      type: 'LaneDragStore',
      required: true,
      description: 'The `drag` that `useLaneDrag` returns.',
    },
    {
      name: 'select',
      type: '(state: LaneDragChange | null) => T',
      required: true,
      description: 'Picks what this component shows from the drag under way, or from null when there is none.',
    },
    {
      name: 'isEqual',
      type: '(a: T, b: T) => boolean',
      required: false,
      default: 'Object.is',
      description: 'Says when two selections are the same, so a selection built anew on each move renders only when it changes. Default `Object.is`.',
    },
  ],
} as const satisfies ComponentMeta;
