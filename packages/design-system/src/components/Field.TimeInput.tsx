/// <reference lib="esnext.temporal" preserve="true" />
import { formatTime, parseTime } from './timeText.js';
import { htmlTime, valueBounds } from './htmlValue.js';
import { TypedInput, type TypedInputProps } from './Field.TypedInput.js';

export type FieldTimeInputProps = TypedInputProps<Temporal.PlainTime> & {
  /** The earliest time. A form with an earlier time is invalid. Later than `max`, it makes an overnight range, from `min` through midnight to `max`. */
  min?: Temporal.PlainTime;
  /** The latest time. A form with a later time is invalid. */
  max?: Temporal.PlainTime;
};

/**
 * A text input for a time, typed in the locale's own words, such as 9:30 pm in
 * en-US. It reads the text with parseTime on blur, Enter and a submit of its
 * form, rewrites it as formatTime writes it and calls `onValueChange`; text
 * that is no time stays, invalid. The time goes in a native time input the
 * browser validates, so `required`, `min` and `max` block a submit and
 * Form.Root shows them. A Field.Picker beside it is named from the timePicker
 * string and shows a clock.
 */
export function TimeInput({ min, max, locale, ...props }: FieldTimeInputProps) {
  const text = (time: Temporal.PlainTime) => formatTime(time, { locale });
  return (
    <TypedInput
      {...props}
      format={{
        picks: 'time',
        parse: (typed) => parseTime(typed, { locale }),
        format: text,
        equals: (a, b) => a.equals(b),
        valueInput: (value) => ({
          type: 'time',
          value: value ? htmlTime(value) : '',
          // Any time can be typed, so no step is off.
          step: 'any',
          ...valueBounds(min, max, htmlTime, text),
        }),
      }}
    />
  );
}
