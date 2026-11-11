import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'timeOptions',
  description:
    'The times for an OptionList.Root of times: every step minutes from midnight between min and max, with value among them when it is in range, each as { value, label, time }: an ISO value to key an OptionList.Option, a label in the locale and the Temporal.PlainTime.',
  props: [
    {
      name: 'step',
      type: 'number',
      required: false,
      default: '30',
      description: 'Minutes between the times, from midnight.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'The earliest time. Later than max, it makes an overnight range, from min through midnight to max, as a native time input reads it.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainTime',
      required: false,
      description: 'The latest time.',
    },
    {
      name: 'value',
      type: 'Temporal.PlainTime | null',
      required: false,
      description: 'The picked time, listed in its place when it is in range but between two steps, such as 9:07.',
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: "The locale for the labels, such as \"ko\". The runtime's own when not set.",
    },
  ],
} as const satisfies ComponentMeta;
