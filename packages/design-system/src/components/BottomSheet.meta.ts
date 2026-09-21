import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet',
  kind: 'component',
  description: 'Modal bottom sheet. Custom portal, not a native dialog. Mid and full snap.',
  whenToUse: [
    'Sheet from the bottom edge. Mid and full snap. Custom portal, not a native dialog.',
  ],
  whenNotToUse: [
    'Use Dialog when the task stays centered. Do not morph a Dialog into a sheet.',
  ],
  intents: [
    'contextual-overlay',
  ],
  slots: [
    { name: 'children', accepts: [
      'BottomSheet.Header',
      'BottomSheet.Body',
      'BottomSheet.Footer',
      'BottomSheet.Grabber',
      'BottomSheet.Close',
      'BottomSheet.Title',
      'BottomSheet.Description',
    ], required: false, description: 'Sheet parts.' },
  ],
  related: [
    { id: 'Dialog', relation: 'alternative' },
  ],
  docs: '/bottomsheet',
  props: [
    {
      name: 'open',
      type: 'boolean',
      required: true,
      description: 'Controlled open state.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: SheetCloseReason) => void',
      required: true,
      description: 'Dismiss requests. Staying open keeps the sheet open.',
    },
    {
      name: 'snap',
      type: '"mid" | "full"',
      required: false,
      description: 'Controlled snap. Omit for uncontrolled.',
    },
    {
      name: 'defaultSnap',
      type: '"mid" | "full"',
      required: false,
      default: '"mid"',
      description: 'Initial snap when uncontrolled.',
    },
    {
      name: 'snapPoints',
      type: 'ReadonlyArray<"mid" | "full">',
      required: false,
      default: '["mid", "full"]',
      description: 'Allowed snaps. ["full"] disables mid.',
    },
    {
      name: 'dismissOnEscape',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Escape calls onOpenChange(false, "escape").',
    },
    {
      name: 'dismissOnScrim',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Scrim click calls onOpenChange(false, "scrim").',
    },
    {
      name: 'dismissOnDrag',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Drag past the threshold dismisses.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Name when BottomSheet.Title is omitted.',
    },
  ],
} as const satisfies ComponentMeta;
