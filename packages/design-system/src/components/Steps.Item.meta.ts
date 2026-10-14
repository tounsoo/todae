import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Steps.Item',
  description:
    'One step, as an li with a marker for its status and a hidden status word read before its content. A done step shows the check glyph and struck-through text, the current step a spinner, and a step with an error the error glyph. Takes native li attributes.',
  props: [
    {
      name: 'status',
      type: '"done" | "current" | "pending" | "error"',
      required: false,
      default: '"pending"',
      description: 'Sets data-status and the marker. A current step takes aria-current="step".',
    },
    {
      name: 'statusLabel',
      type: 'string',
      required: false,
      description: 'The hidden status word read before the step, in place of the stepDone, stepCurrent, stepPending or stepError string when not empty.',
    },
  ],
} as const satisfies ComponentMeta;
