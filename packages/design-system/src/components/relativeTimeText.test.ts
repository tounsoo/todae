import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTimeText.js';

const zone = 'America/New_York';
const at = (text: string) => Temporal.PlainDateTime.from(text).toZonedDateTime(zone);
const now = at('2026-10-22T09:30');
const rel = (text: string, locale = 'en-US') => formatRelativeTime(at(text), now, { locale });

describe('formatRelativeTime', () => {
  it('counts whole seconds, minutes and hours under a day', () => {
    expect(formatRelativeTime(now, now, { locale: 'en-US' })).toBe('now');
    expect(formatRelativeTime(now.subtract({ seconds: 45 }), now, { locale: 'en-US' })).toBe('45 seconds ago');
    expect(rel('2026-10-22T09:27')).toBe('3 minutes ago');
    expect(formatRelativeTime(now.subtract({ minutes: 59, seconds: 59 }), now, { locale: 'en-US' })).toBe(
      '59 minutes ago',
    );
    expect(rel('2026-10-22T07:00')).toBe('2 hours ago');
    // Past midnight but under a day is still hours.
    expect(rel('2026-10-21T23:00')).toBe('10 hours ago');
    expect(rel('2026-10-22T12:31')).toBe('in 3 hours');
  });

  it('counts days, weeks, months and years between dates', () => {
    expect(rel('2026-10-21T09:00')).toBe('yesterday');
    // 33 hours, but two dates back.
    expect(rel('2026-10-20T23:00')).toBe('2 days ago');
    expect(rel('2026-10-16T09:30')).toBe('6 days ago');
    expect(rel('2026-10-15T09:30')).toBe('last week');
    expect(rel('2026-10-01T09:30')).toBe('3 weeks ago');
    expect(rel('2026-09-22T09:30')).toBe('last month');
    expect(rel('2026-04-10T09:30')).toBe('6 months ago');
    expect(rel('2024-11-01T09:30')).toBe('last year');
    expect(rel('2023-10-22T09:30')).toBe('3 years ago');
    expect(rel('2026-11-05T09:30')).toBe('in 2 weeks');
    expect(rel('2026-10-23T10:00')).toBe('tomorrow');
  });

  it('takes now as an instant', () => {
    expect(formatRelativeTime(at('2026-10-22T09:27'), now.toInstant(), { locale: 'en-US' })).toBe('3 minutes ago');
  });

  it("reads dates in value's time zone", () => {
    // 25.5 hours apart: two dates apart in Seoul, one in New York.
    const value = Temporal.ZonedDateTime.from('2026-10-21T23:00+09:00[Asia/Seoul]');
    const later = Temporal.ZonedDateTime.from('2026-10-23T00:30+09:00[Asia/Seoul]');
    expect(formatRelativeTime(value, later.withTimeZone(zone), { locale: 'en-US' })).toBe('2 days ago');
    expect(formatRelativeTime(value.withTimeZone(zone), later, { locale: 'en-US' })).toBe('yesterday');
  });

  it('counts hours on a date that holds 25', () => {
    // New York falls back on 2026-11-01.
    const start = at('2026-11-01T00:00');
    expect(formatRelativeTime(start, start.add({ hours: 24, minutes: 30 }), { locale: 'en-US' })).toBe('24 hours ago');
  });

  it('writes the locale, style and numeric options', () => {
    expect(rel('2026-10-22T09:27', 'ko')).toBe('3분 전');
    expect(rel('2026-10-21T09:00', 'ko')).toBe('어제');
    expect(rel('2026-11-05T09:30', 'ko')).toBe('2주 후');
    expect(formatRelativeTime(at('2026-10-21T09:00'), now, { locale: 'en-US', numeric: 'always' })).toBe('1 day ago');
    expect(formatRelativeTime(at('2026-10-22T09:27'), now, { locale: 'en-US', style: 'short' })).toBe('3 min. ago');
  });

  it('writes a date in another calendar by its Gregorian date', () => {
    const value = at('2026-10-21T09:00').withCalendar('hebrew');
    expect(formatRelativeTime(value, now, { locale: 'en-US' })).toBe('yesterday');
  });
});
