/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe range text for a text input beside Field.DateRangePicker: no hooks or context.

/** A span of days, start and end included. start is never after end. */
export type DateRange = { start: Temporal.PlainDate; end: Temporal.PlainDate };
