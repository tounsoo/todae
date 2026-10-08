import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useAnnouncer',
  description:
    'Takes no arguments and returns announce(message, options?), which reads message to screen readers through one visually hidden live region shared by the whole document. The props below are announce arguments.',
  props: [
    {
      name: 'message',
      type: 'string',
      required: true,
      description: 'Text to read. The same message twice is read twice. An empty string clears the region.',
    },
    {
      name: 'politeness',
      type: '"polite" | "assertive"',
      required: false,
      default: '"polite"',
      description: 'Options field. polite waits for the screen reader to finish; assertive interrupts it.',
    },
  ],
} as const satisfies ComponentMeta;
