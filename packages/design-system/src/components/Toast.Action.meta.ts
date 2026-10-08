import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Action",
  description:
    "Button.Root for the toast's one action, such as Undo. Dismisses the toast after onClick.",
  props: [
    {
      name: "variant",
      type: "\"primary\" | \"secondary\" | \"ghost\"",
      required: false,
      default: "\"secondary\"",
      description: "Button variant.",
    },
    {
      name: "onClick",
      type: "React.MouseEventHandler<HTMLButtonElement>",
      required: false,
      description: "Runs the action. Call event.preventDefault() to keep the toast open.",
    },
  ],
} as const satisfies ComponentMeta;
