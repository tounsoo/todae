/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe time text for a text input beside Field.TimePicker: no hooks or context.
import { normalize, type DateTextOptions } from './dateText';

export type TimeTextOptions = DateTextOptions;

// One formatter per locale and style: a list of times formats hundreds at once.
const formats = new Map<string, Intl.DateTimeFormat>();

const hasSeconds = (time: Temporal.PlainTime) =>
  time.second !== 0 || time.millisecond !== 0 || time.microsecond !== 0 || time.nanosecond !== 0;

/**
 * The time as `locale` writes it in its short time style, such as `9:30 PM`
 * in en-US, `21:30` in de and `오후 9:30` in ko, or in its medium style, with
 * seconds, when the time has seconds.
 */
export function formatTime(time: Temporal.PlainTime, options: TimeTextOptions = {}): string {
  const style = hasSeconds(time) ? 'medium' : 'short';
  const key = `${options.locale ?? ''}|${style}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(options.locale, { timeStyle: style, timeZone: 'UTC' });
    formats.set(key, format);
  }
  // A Date in UTC, as Intl formats it everywhere, Temporal or not.
  return format.format(Date.UTC(1970, 0, 1, time.hour, time.minute, time.second, time.millisecond));
}

type LocaleTime = {
  /**
   * The locale's words for a part of the day, normalized, such as "pm" in
   * en-US or "오후" in ko, by the hour they are written with, to the hour of
   * the day. Some locales name more than two parts, such as 凌晨 and 中午 in zh-TW.
   * Keyed without spaces, so "p. m." can be typed as "pm".
   */
  periods: Map<string, Map<number, number>>;
  /** Words the locale's time styles write between the numbers, such as "h" in fr-CA. */
  literals: Set<string>;
};

const localeTimes = new Map<string, LocaleTime>();

// Splits a letter from a digit beside it, so "9pm" and "21h30" read as words and numbers.
const split = (text: string) =>
  normalize(text)
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2');

function localeTime(locale: string | undefined): LocaleTime {
  const key = locale ?? '';
  const cached = localeTimes.get(key);
  if (cached) return cached;
  const periods = new Map<string, Map<number, number>>();
  const literals = new Set<string>();
  // The locale's own clock, and every clock it may be written in: 0 to 11, as in ja, 1 to 12 and 0 to 23.
  const clocks: Intl.DateTimeFormatOptions[] = [{}, { hourCycle: 'h11' }, { hourCycle: 'h12' }, { hourCycle: 'h23' }];
  for (const clock of clocks) {
    // The time styles, and hours and minutes alone, which some locales write with other words, such as 上午 for 凌晨 in zh-TW.
    const styles: Intl.DateTimeFormatOptions[] = [{ timeStyle: 'short' }, { timeStyle: 'medium' }, { hour: 'numeric', minute: '2-digit' }];
    for (const style of styles) {
      const format = new Intl.DateTimeFormat(locale, { ...clock, ...style, timeZone: 'UTC' });
      for (let hour = 0; hour < 24; hour++) {
        const parts = format.formatToParts(new Date(Date.UTC(2026, 9, 13, hour, 30, 15)));
        const shown = Number(normalize(parts.find((part) => part.type === 'hour')?.value ?? ''));
        for (const part of parts) {
          if (part.type === 'dayPeriod') {
            const name = normalize(part.value).replace(/ /g, '');
            if (!name) continue;
            const hours = periods.get(name) ?? new Map<number, number>();
            hours.set(shown, hour);
            periods.set(name, hours);
          } else if (part.type === 'literal') {
            for (const word of split(part.value).split(' ')) if (/\p{L}/u.test(word)) literals.add(word);
          }
        }
      }
    }
  }
  const text = { periods, literals };
  localeTimes.set(key, text);
  return text;
}

/**
 * The time in typed text, or `null` when the text is not one. It reads an
 * hour, an hour and minutes, or an hour, minutes and seconds, such as `9`,
 * `9:30`, `21.30.15` or `0930`, with the locale's own words for the morning
 * or afternoon, or another part of the day, before or after them, such as
 * `9:30 pm` in en-US or `오후 9:30` in ko. Letter case does not matter,
 * digits may be in any script, and the numbers may be separated by any
 * punctuation, symbols, spaces or words the locale writes between them, such as `21 h 30` in fr-CA. Without a word for
 * a part of the day, the hour is 0 to 23; with one, it is 0 to 12, read as
 * the locale reads that word, so `0 pm` and `12 pm` are both noon in en-US.
 */
export function parseTime(text: string, options: TimeTextOptions = {}): Temporal.PlainTime | null {
  const { periods, literals } = localeTime(options.locale);
  const tokens = split(text).split(' ').filter(Boolean);
  if (tokens.length === 0) return null;
  // A word for the part of the day, first or last. The locale may write it as
  // several words, such as "p. m.", which may be typed with or without spaces.
  let period: Map<number, number> | undefined;
  find: for (let count = Math.min(tokens.length, 4); count >= 1; count--) {
    for (const atStart of [true, false]) {
      const words = atStart ? tokens.slice(0, count) : tokens.slice(-count);
      const hours = periods.get(words.join(''));
      if (!hours) continue;
      period = hours;
      tokens.splice(atStart ? 0 : tokens.length - count, count);
      break find;
    }
  }
  const numbers: string[] = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) numbers.push(token);
    else if (!literals.has(token)) return null;
  }
  let hour: string | undefined;
  let minute = '0';
  let second = '0';
  if (numbers.length === 1) {
    const digits = numbers[0]!;
    // 9, 21, 930 or 0930.
    if (digits.length <= 2) hour = digits;
    else if (digits.length <= 4) {
      hour = digits.slice(0, -2);
      minute = digits.slice(-2);
    } else return null;
  } else if (numbers.length === 2 || numbers.length === 3) {
    [hour, minute, second = '0'] = numbers as [string, string, string?];
    if (minute.length !== 2 || (numbers.length === 3 && second.length !== 2)) return null;
  } else return null;
  if (hour === undefined || hour.length > 2) return null;
  let h = Number(hour);
  const m = Number(minute);
  const s = Number(second);
  if (period) {
    const day = period.get(h);
    if (day === undefined) return null;
    h = day;
  } else if (h > 23) return null;
  if (m > 59 || s > 59) return null;
  return new Temporal.PlainTime(h, m, s);
}
