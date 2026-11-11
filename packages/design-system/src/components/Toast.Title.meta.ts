import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Title",
  description:
    "Short summary, set in the title weight. A p element.",
  props: [
    {
      name: "children",
      type: "React.ReactNode",
      required: false,
      description: "Title text.",
    },
  ],
} as const satisfies ComponentMeta;
