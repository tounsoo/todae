import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Icon",
  description:
    "Slot for any icon, placed before the text. aria-hidden by default.",
  props: [
    {
      name: "children",
      type: "React.ReactNode",
      required: false,
      description: "Icon graphic from your own icon set.",
    },
  ],
} as const satisfies ComponentMeta;
