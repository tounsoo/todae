import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Root',
  description: 'Modal bottom sheet on a native <dialog> opened with showModal(). Mid and full snap.',
  props: [
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state. Leave it out for an uncontrolled sheet.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Initial open state when uncontrolled.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: SheetCloseReason) => void',
      required: false,
      description: 'Dismiss requests. Staying open keeps the sheet open. reason is "form" for a <form method="dialog"> submit (read returnValue) and "native" when something else outside Todae closed the <dialog>; it shows again while open stays true.',
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
      description: 'Escape calls onOpenChange(false, "escape"). false sets closedby="none", so the browser ignores the close request.',
    },
    {
      name: 'dismissOnBackdrop',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'A click on the scrim (the dialog ::backdrop) calls onOpenChange(false, "backdrop").',
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
