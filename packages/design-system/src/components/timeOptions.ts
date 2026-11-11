/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe times for a list of times: no hooks or context.
import { formatTime } from './timeText.js';

const MINUTES_PER_DAY = 24 * 60;

/**
 * The times every `step` minutes from midnight between `min` and `max`, with
 * `value` among them when it is in range. With `overnight`, a `min` later
 * than `max` is a range from `min` through midnight to `max`, as a native time
 * input reads it, so the list offers what the browser accepts. Without it, such
 * a range lists nothing, as for the times of one day beside a calendar.
 */
export function timeSlots(
  step: number,
  min?: Temporal.PlainTime,
  max?: Temporal.PlainTime,
  value?: Temporal.PlainTime | null,
  allowOvernight = false,
) {
  const every = Number.isFinite(step) && step >= 1 ? Math.round(step) : 30;
  const overnight = allowOvernight && min && max && Temporal.PlainTime.compare(min, max) > 0;
  const inRange = (time: Temporal.PlainTime) => {
    const afterMin = !min || Temporal.PlainTime.compare(time, min) >= 0;
    const beforeMax = !max || Temporal.PlainTime.compare(time, max) <= 0;
    return overnight ? afterMin || beforeMax : afterMin && beforeMax;
  };
  const slots: Temporal.PlainTime[] = [];
  for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += every) {
    const time = new Temporal.PlainTime(Math.floor(minutes / 60), minutes % 60);
    if (inRange(time)) slots.push(time);
  }
  if (value && inRange(value) && !slots.some((time) => time.equals(value))) {
    slots.push(value);
    slots.sort(Temporal.PlainTime.compare);
  }
  return slots;
}

/** One time in the list `timeOptions` returns. */
export type TimeOption = {
  /** The time as an ISO string, such as 09:30:00, unique in the list: an OptionList.Option's value. */
  value: string;
  /** The time as `locale` writes it, such as 9:30 AM in en-US. */
  label: string;
  time: Temporal.PlainTime;
};

export type TimeOptionsOptions = {
  /** Minutes between the times, from midnight. Defaults to 30. */
  step?: number;
  /** The earliest time. Later than `max`, it makes an overnight range, from `min` through midnight to `max`, as a native time input reads it. */
  min?: Temporal.PlainTime;
  /** The latest time. */
  max?: Temporal.PlainTime;
  /** The picked time, listed in its place when it is in range but between two steps, such as 9:07. */
  value?: Temporal.PlainTime | null;
  /** The locale for the times' text, such as "ko". The runtime's own when not set. */
  locale?: string;
};

/**
 * The times for an OptionList of times: every `step` minutes from midnight
 * between `min` and `max`, with `value` among them when it is in range, each
 * with an ISO `value` to key an OptionList.Option and a `label` in the
 * locale. Inside a Field.Picker beside a Field.TimeInput, an OptionList.Root
 * of them picks the time and closes the picker.
 */
export function timeOptions({ step = 30, min, max, value, locale }: TimeOptionsOptions = {}): TimeOption[] {
  return timeSlots(step, min, max, value, true).map((time) => ({
    value: time.toString(),
    label: formatTime(time, { locale }),
    time,
  }));
}
