import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Calendar.Grid',
  description:
    'The shown month as a role="grid" table, one week to a row, labelled by Calendar.Header\'s month while one is rendered, unless it has its own aria-label or aria-labelledby. One Tab stop; arrow keys move by day and week, Home and End to the ends of the week, Page Up and Page Down by month, and with Shift by year. While Calendar.Header shows the years, it is a grid of twelve years in the same pattern, by year and row of four, and by page. In range mode, Escape drops the first pick of a range and stops there, so a popover around the calendar stays open. Takes native table attributes except role and children.',
  props: [
    {
      name: 'renderDay',
      type: '(day: CalendarDayState) => React.ReactNode',
      required: false,
      description:
        "Renders inside each day button the grid draws, called with the day's date and whether it is outside the shown month, today, selected, or cannot be picked. The button stays the one Tab stop and keeps the full date as its name, and the content is read as the day's description. The content is not interactive. Ignored while the years show.",
    },
    {
      name: 'showOutsideDays',
      type: 'boolean',
      required: false,
      default: 'false',
      description:
        'Draws the leading and trailing days as buttons, in the weekday color, and marks them outside. Off by default, and passing renderDay does not draw those days. Ignored while the years show.',
    },
  ],
} as const satisfies ComponentMeta;
