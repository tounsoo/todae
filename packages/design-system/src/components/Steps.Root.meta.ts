import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Steps.Root',
  description:
    'An ordered list of steps, such as an agent\'s plan, a checklist or the steps of a form, as an ol with role="list". Name it with aria-label or aria-labelledby when the page has more than one. Takes native ol attributes.',
  props: [
    {
      name: 'variant',
      type: '"plan" | "progress"',
      required: false,
      default: '"plan"',
      description: 'plan is work that runs: the current step shows a spinner and done steps are struck through. progress is where a person is in a form: the current step shows a still ring with a dot and done steps keep their text. Sets data-variant.',
    },
  ],
} as const satisfies ComponentMeta;
