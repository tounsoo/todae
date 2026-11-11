import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Description",
  description:
    "Longer text under the title.",
  props: [
    {
      name: "children",
      type: "React.ReactNode",
      required: false,
      description: "Description content.",
    },
  ],
} as const satisfies ComponentMeta;
