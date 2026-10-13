import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Calendar.Root',
  description:
    'A role="group" that holds one selected date, a Temporal.PlainDate, for its Calendar.Header and Calendar.Grid. It shows the month of the date that holds the grid\'s Tab stop. Todae ships no Temporal polyfill.',
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDate | null',
      required: false,
      description: 'Controlled selected date, or null for none. Pass with onValueChange.',
    },
    {
      name: 'defaultValue',
      type: 'Temporal.PlainDate | null',
      required: false,
      description: 'Initial selected date when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: Temporal.PlainDate) => void',
      required: false,
      description: 'Fires with the date a person picks.',
    },
    {
      name: 'min',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The earliest date that can be picked.',
    },
    {
      name: 'max',
      type: 'Temporal.PlainDate',
      required: false,
      description: 'The latest date that can be picked.',
    },
    {
      name: 'isDateDisabled',
      type: '(date: Temporal.PlainDate) => boolean',
      required: false,
      description: 'Returns true for a date that cannot be picked, such as a holiday.',
    },
    {
      name: 'defaultMonth',
      type: 'Temporal.PlainYearMonth',
      required: false,
      description: "The month shown first when there is no value. Today's month when not set.",
    },
    {
      name: 'firstDayOfWeek',
      type: '1 | 2 | 3 | 4 | 5 | 6 | 7',
      required: false,
      description: "The first column of the grid, 1 (Monday) to 7 (Sunday). The locale's own first day when the browser reports it, else 7.",
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: 'The locale for month and weekday names, such as "ko". The browser\'s own when not set.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Stops every part from changing the date or month. A disabled Fieldset sets it too.',
    },
  ],
} as const satisfies ComponentMeta;
