import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Root",
  description:
    "One toast, in one of four tones. Takes native div attributes.",
  props: [
    {
      name: "tone",
      type: "\"info\" | \"success\" | \"warning\" | \"critical\"",
      required: false,
      default: "the toast's own tone",
      description: "Colors from color.status.<tone> through the toast contract tokens.",
    },
    {
      name: "children",
      type: "React.ReactNode",
      required: false,
      description: "Toast parts, or any content.",
    },
  ],
} as const satisfies ComponentMeta;
