import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "useModalLayer",
  description:
    "useModalLayer(ref, open). Puts a modal <dialog> of your own in Todae's modal stack while open is true and it is shown with showModal(). Toast.Region moves its toasts into the modal in front. Dialog and BottomSheet join the stack by themselves.",
  props: [
    {
      name: "ref",
      type: "RefObject<HTMLDialogElement | null>",
      required: true,
      description: "The <dialog>. It must be in the document when open turns true.",
    },
    {
      name: "open",
      type: "boolean",
      required: true,
      description: "Whether the dialog is open. Set it to false when the dialog starts closing, before any exit motion.",
    },
  ],
} as const satisfies ComponentMeta;
