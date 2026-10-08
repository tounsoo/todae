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
      description: "The <dialog>.",
    },
    {
      name: "open",
      type: "boolean",
      required: true,
      description: "Whether the dialog may be shown. It counts while this is true and it is shown with showModal(), until close().",
    },
  ],
} as const satisfies ComponentMeta;
