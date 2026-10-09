import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Region",
  description:
    "Where toasts show, in a popover=\"manual\" element in the top layer. Render one near the app root. While a modal dialog in Todae's modal stack is open, the toasts move inside it so they stay usable. Takes native section attributes.",
  props: [
    {
      name: "toaster",
      type: "Toaster<T>",
      required: true,
      description: "The store from createToaster().",
    },
    {
      name: "children",
      type: "(toast: ToastRecord<T>) => React.ReactNode",
      required: true,
      description: "Renders one toast, usually a Toast.Root.",
    },
    {
      name: "placement",
      type: "\"top-start\" | \"top-center\" | \"top-end\" | \"bottom-start\" | \"bottom-center\" | \"bottom-end\"",
      required: false,
      default: "\"bottom-end\"",
      description: "Corner or edge of the viewport. The newest toast sits nearest the edge.",
    },
    {
      name: "layout",
      type: "\"list\" | \"stack\"",
      required: false,
      default: "\"list\"",
      description: "list shows every toast in full. stack collapses them behind the newest and spreads them while the pointer is over them or keyboard focus is inside.",
    },
    {
      name: "limit",
      type: "number",
      required: false,
      default: "3",
      description: "How many toasts show at once. Later ones wait their turn.",
    },
    {
      name: "hotkey",
      type: "string | null",
      required: false,
      default: "\"F8\"",
      description: "Key that moves focus to the toasts, such as \"F8\" or \"Alt+T\". Modifiers are Alt (or Option), Ctrl, Meta (or Cmd) and Shift. null turns it off.",
    },
    {
      name: "aria-label",
      type: "string",
      required: false,
      default: "\"Notifications\"",
      description: "Name of the region landmark. Default is the notifications string from StringsProvider.",
    },
  ],
} as const satisfies ComponentMeta;
