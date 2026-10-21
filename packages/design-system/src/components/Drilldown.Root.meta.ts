import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drilldown.Root',
  description:
    'Owns the stack of views, the first view first and the shown view last. Renders no element, so it can wrap an overlay header and body.',
  props: [
    {
      name: 'value',
      type: 'readonly string[]',
      required: false,
      description: 'Controlled stack of view values, the first view first and the shown view last. Pass with onValueChange.',
    },
    {
      name: 'defaultValue',
      type: 'readonly string[]',
      required: false,
      description: 'Initial stack when uncontrolled. The stack goes back to it, without onValueChange, each time an enclosing Dialog, Drawer or BottomSheet closes.',
    },
    {
      name: 'onValueChange',
      type: '(value: readonly string[], reason: DrilldownChangeReason) => void',
      required: false,
      description: 'Fires with the next stack. reason is push (Drilldown.Trigger), back (Drilldown.Back) or escape (Escape, or the Android back gesture in a modal).',
    },
    {
      name: 'escape',
      type: '"back" | "close"',
      required: false,
      default: '"back"',
      description: 'back: Escape goes back one view, and closes an enclosing overlay only at the first view. close: Escape is left to the overlay.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Drilldown.Viewport, Drilldown.Back and Drilldown.Label, anywhere inside.',
    },
  ],
} as const satisfies ComponentMeta;
