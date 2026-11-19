import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EXPANSION_CAP,
  continueFrom,
  excludeOccurrence,
  expandSeries,
  occurrenceIndex,
  overrideOccurrence,
  replaceSeries,
  seriesFromDraft,
  seriesId,
  truncateBefore,
  viewWindow,
  type EventSeries,
  type RecurrenceRule,
} from './recurrence';

const LA = 'America/Los_Angeles';

function at(zone: string, text: string): Temporal.ZonedDateTime {
  const plain = text.replace(/([+-]\d{2}:\d{2})(\[.*\])?$/, '');
  return Temporal.PlainDateTime.from(plain).toZonedDateTime(zone);
}

function window(zone: string, start: string, end: string) {
  return { start: at(zone, start), end: at(zone, end) };
}

function rule(partial: Partial<RecurrenceRule> & Pick<RecurrenceRule, 'freq'>): RecurrenceRule {
  return { interval: 1, end: { kind: 'never' }, ...partial };
}

function series(partial: Partial<EventSeries> & Pick<EventSeries, 'start' | 'end'>): EventSeries {
  return {
    id: seriesId('stand-up'),
    title: 'Stand-up',
    timeZone: partial.start.timeZoneId,
    allDay: false,
    rule: null,
    exdates: [],
    overrides: [],
    ...partial,
  };
}

function days(result: { start: Temporal.ZonedDateTime }[]): string[] {
  return result.map((item) => item.start.toPlainDate().toString());
}

describe('expandSeries', () => {
  it('returns occurrences whose start is inside a half-open window, with a stable id and the series id', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T09:30:00-08:00'),
      rule: rule({ freq: 'DAILY' }),
    });
    const range = window(LA, '2026-11-18T00:00:00-08:00', '2026-11-20T00:00:00-08:00');
    const first = expandSeries(item, range);
    const second = expandSeries(item, range);
    expect(days(first)).toEqual(['2026-11-18', '2026-11-19']);
    expect(first.map((occurrence) => occurrence.seriesId)).toEqual(['stand-up', 'stand-up']);
    expect(first.map((occurrence) => occurrence.id)).toEqual(second.map((occurrence) => occurrence.id));
    expect(new Set(first.map((occurrence) => occurrence.id)).size).toBe(2);
    expect(first.every((occurrence) => occurrence.repeats)).toBe(true);
    expect(first[0]?.start.toPlainTime().toString()).toBe('09:00:00');
    expect(first[0]?.end.toPlainTime().toString()).toBe('09:30:00');
  });

  it('excludes an occurrence that starts on the window end and includes one that starts on the window start', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'DAILY' }),
    });
    const result = expandSeries(item, window(LA, '2026-11-16T09:00:00-08:00', '2026-11-17T09:00:00-08:00'));
    expect(days(result)).toEqual(['2026-11-16']);
  });

  it('stops a weekly count in the middle of the week', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T09:30:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['MO', 'WE', 'FR'], end: { kind: 'count', count: 4 } }),
    });
    expect(days(expandSeries(item, window(LA, '2026-11-16T00:00:00-08:00', '2026-11-30T00:00:00-08:00')))).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23']);
  });

  it('steps a daily series by its interval', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'DAILY', interval: 2, end: { kind: 'count', count: 3 } }),
    });
    expect(days(expandSeries(item, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-01T00:00:00-08:00')))).toEqual([
      '2026-11-16',
      '2026-11-18',
      '2026-11-20',
    ]);
  });

  it('counts from the series start when the window opens on a later occurrence', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'DAILY', end: { kind: 'count', count: 5 } }),
    });
    expect(days(expandSeries(item, window(LA, '2026-11-18T00:00:00-08:00', '2026-12-01T00:00:00-08:00')))).toEqual([
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
  });

  it('supports weekly BYDAY and INTERVAL, and does not emit a chosen day before the series start', () => {
    const item = series({
      start: at(LA, '2026-11-18T09:00:00-08:00'),
      end: at(LA, '2026-11-18T10:00:00-08:00'),
      rule: rule({ freq: 'WEEKLY', interval: 2, byDay: ['MO', 'WE'] }),
    });
    const result = expandSeries(item, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-16T00:00:00-08:00'));
    expect(days(result)).toEqual(['2026-11-18', '2026-11-30', '2026-12-02', '2026-12-14']);
  });

  it('stops a COUNT and includes the occurrence on an UNTIL instant', () => {
    const start = at(LA, '2026-11-16T09:00:00-08:00');
    const end = at(LA, '2026-11-16T09:30:00-08:00');
    const counted = series({ start, end, rule: rule({ freq: 'DAILY', end: { kind: 'count', count: 3 } }) });
    expect(days(expandSeries(counted, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-01T00:00:00-08:00')))).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
    const until = series({
      start,
      end,
      rule: rule({ freq: 'DAILY', end: { kind: 'until', until: at(LA, '2026-11-18T09:00:00-08:00') } }),
    });
    expect(days(expandSeries(until, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-01T00:00:00-08:00')))).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
  });

  it('keeps a 9:00 weekly meeting at 9:00 local across the spring-forward and the fall-back', () => {
    const item = series({
      start: at(LA, '2026-03-02T09:00:00-08:00'),
      end: at(LA, '2026-03-02T10:00:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['MO'] }),
    });
    const spring = expandSeries(item, window(LA, '2026-03-01T00:00:00-08:00', '2026-03-17T00:00:00-08:00'));
    expect(spring.map((occurrence) => occurrence.start.toPlainTime().toString())).toEqual(['09:00:00', '09:00:00', '09:00:00']);
    expect(spring.map((occurrence) => occurrence.start.offset)).toEqual(['-08:00', '-07:00', '-07:00']);
    expect(days(spring)).toEqual(['2026-03-02', '2026-03-09', '2026-03-16']);

    const autumn = series({
      start: at(LA, '2026-10-25T09:00:00-07:00'),
      end: at(LA, '2026-10-25T10:00:00-07:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['SU'] }),
    });
    const fallen = expandSeries(autumn, window(LA, '2026-10-25T00:00:00-07:00', '2026-11-09T00:00:00-08:00'));
    expect(fallen.map((occurrence) => occurrence.start.toPlainTime().toString())).toEqual(['09:00:00', '09:00:00', '09:00:00']);
    expect(fallen.map((occurrence) => occurrence.start.offset)).toEqual(['-07:00', '-08:00', '-08:00']);
    expect(days(fallen)).toEqual(['2026-10-25', '2026-11-01', '2026-11-08']);
  });

  it('keeps the stored end when a single event starts in the later repeated hour', () => {
    const start = Temporal.ZonedDateTime.from('2027-11-07T01:00:00-08:00[America/Los_Angeles]');
    const end = Temporal.ZonedDateTime.from('2027-11-07T01:30:00-08:00[America/Los_Angeles]');
    const item = series({ start, end });
    const result = expandSeries(item, {
      start: Temporal.ZonedDateTime.from('2027-11-07T00:00:00-07:00[America/Los_Angeles]'),
      end: Temporal.ZonedDateTime.from('2027-11-08T00:00:00-08:00[America/Los_Angeles]'),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.start.toString()).toBe(start.toString());
    expect(result[0]?.end.toString()).toBe(end.toString());
  });

  it('skips a month that has no 31st, and a yearly 29 February that is not a leap year', () => {
    const monthly = series({
      start: at(LA, '2026-01-31T09:00:00-08:00'),
      end: at(LA, '2026-01-31T10:00:00-08:00'),
      rule: rule({ freq: 'MONTHLY' }),
    });
    expect(days(expandSeries(monthly, window(LA, '2026-01-01T00:00:00-08:00', '2026-07-01T00:00:00-07:00')))).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ]);
    const leap = series({
      timeZone: 'UTC',
      start: at('UTC', '2024-02-29T09:00:00+00:00'),
      end: at('UTC', '2024-02-29T10:00:00+00:00'),
      rule: rule({ freq: 'YEARLY' }),
    });
    expect(days(expandSeries(leap, window('UTC', '2024-01-01T00:00:00+00:00', '2029-01-01T00:00:00+00:00')))).toEqual(['2024-02-29', '2028-02-29']);
  });

  it('drops an EXDATE and replaces an overridden occurrence, still keyed by the original start', () => {
    const start = at(LA, '2026-11-16T09:00:00-08:00');
    const end = at(LA, '2026-11-16T09:30:00-08:00');
    const item = series({ start, end, rule: rule({ freq: 'DAILY', end: { kind: 'count', count: 4 } }) });
    const removed = at(LA, '2026-11-17T09:00:00-08:00');
    const moved = at(LA, '2026-11-18T09:00:00-08:00');
    const edited = excludeOccurrence(
      overrideOccurrence(item, moved, {
        title: 'Moved',
        start: at(LA, '2026-11-18T15:00:00-08:00'),
        end: at(LA, '2026-11-18T16:00:00-08:00'),
        allDay: false,
      }),
      removed,
    );
    if (!edited) throw new Error('occurrences remain');
    const range = window(LA, '2026-11-16T00:00:00-08:00', '2026-11-20T00:00:00-08:00');
    const result = expandSeries(edited, range);
    expect(result.map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.title])).toEqual([
      ['2026-11-16', 'Stand-up'],
      ['2026-11-18', 'Moved'],
      ['2026-11-19', 'Stand-up'],
    ]);
    const shifted = result[1];
    expect(shifted?.originalStart.toString()).toBe(moved.toString());
    expect(shifted?.id).toBe(expandSeries(item, range)[2]?.id);
    const counted = excludeOccurrence(series({ start, end, rule: rule({ freq: 'DAILY', end: { kind: 'count', count: 3 } }) }), removed);
    if (!counted) throw new Error('occurrences remain');
    expect(days(expandSeries(counted, window(LA, '2026-11-16T00:00:00-08:00', '2026-12-01T00:00:00-08:00')))).toEqual(['2026-11-16', '2026-11-18']);
    expect(days(expandSeries(edited, window(LA, '2026-11-18T00:00:00-08:00', '2026-11-19T00:00:00-08:00')))).toEqual(['2026-11-18']);
  });

  it('includes an override that was moved into the window and leaves one out that was moved past the end', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'DAILY' }),
    });
    const brought = overrideOccurrence(item, at(LA, '2026-11-20T09:00:00-08:00'), {
      title: 'Brought in',
      start: at(LA, '2026-11-18T11:00:00-08:00'),
      end: at(LA, '2026-11-18T12:00:00-08:00'),
      allDay: false,
    });
    const taken = overrideOccurrence(brought, at(LA, '2026-11-18T09:00:00-08:00'), {
      title: 'Taken out',
      start: at(LA, '2026-12-01T09:00:00-08:00'),
      end: at(LA, '2026-12-01T10:00:00-08:00'),
      allDay: false,
    });
    const result = expandSeries(taken, window(LA, '2026-11-18T00:00:00-08:00', '2026-11-19T00:00:00-08:00'));
    expect(result.map((occurrence) => occurrence.title)).toEqual(['Brought in']);
  });

  it('does not hang on an unbounded daily series, and stops at the cap', () => {
    const item = series({
      timeZone: 'UTC',
      start: at('UTC', '0001-01-01T09:00:00+00:00'),
      end: at('UTC', '0001-01-01T10:00:00+00:00'),
      rule: rule({ freq: 'DAILY' }),
    });
    const farStart = Temporal.PlainDate.from('9999-06-15').toZonedDateTime('UTC');
    const started = performance.now();
    const one = expandSeries(item, { start: farStart, end: farStart.add({ days: 1 }) });
    expect(performance.now() - started).toBeLessThan(100);
    expect(one.map((occurrence) => occurrence.start.toPlainDate().toString())).toEqual(['9999-06-15']);

    const year = expandSeries(item, window('UTC', '2026-01-01T00:00:00+00:00', '2027-01-01T00:00:00+00:00'));
    expect(year).toHaveLength(365);
    const capped = expandSeries(item, window('UTC', '2026-01-01T00:00:00+00:00', '2029-01-01T00:00:00+00:00'));
    expect(capped).toHaveLength(EXPANSION_CAP);
    expect(capped[0]?.start.toPlainDate().toString()).toBe('2026-01-01');
    expect(capped[EXPANSION_CAP - 1]?.start.toPlainDate().toString()).toBe(Temporal.PlainDate.from('2026-01-01').add({ days: EXPANSION_CAP - 1 }).toString());
  });

  it('rejects an interval that would not move forward', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'DAILY', interval: 0 }),
    });
    expect(() => expandSeries(item, window(LA, '2026-11-16T00:00:00-08:00', '2026-11-20T00:00:00-08:00'))).toThrow(RangeError);
  });
});

describe('the recipe pages', () => {
  it('explains the occurrence model in English and Korean, including the 31st and the cap', () => {
    const english = readFileSync(new URL('../../../app/(en)/recipes/event-calendar/page.mdx', import.meta.url), 'utf8');
    const korean = readFileSync(new URL('../../../app/ko/recipes/event-calendar/page.mdx', import.meta.url), 'utf8');
    for (const page of [english, korean]) {
      expect(page).toContain('Book club');
      expect(page).toContain('expandSeries()');
      expect(page).toContain('EXDATE');
      expect(page).toContain('400');
      expect(page).toMatch(/31/);
      expect(page).toContain('This and following');
    }
    expect(english).toContain('skips a month that has no 31st');
    expect(korean).toContain('31일이 없는 달을 건너뜁니다');
    expect(english).toContain('Dragging one occurrence moves that occurrence only');
    expect(korean).toContain('발생 하나를 끌면 그 발생만 옮겨 가고');
    expect(english).toContain('an edit at 1:00 PM is at 3:00 PM when this and the following events start two hours later');
    expect(korean).toContain('오후 1시로 고친 발생은 새 시리즈가 두 시간 늦으면 오후 3시가 됩니다');
  });
});

describe('editing a series', () => {
  const item = series({
    start: at(LA, '2026-11-16T09:00:00-08:00'),
    end: at(LA, '2026-11-16T09:30:00-08:00'),
    rule: rule({ freq: 'WEEKLY', byDay: ['MO'] }),
  });

  it('changes every event when the series is replaced, and keeps an exception on the same ordinal start', () => {
    const moved = overrideOccurrence(item, at(LA, '2026-11-23T09:00:00-08:00'), {
      title: 'Special',
      start: at(LA, '2026-11-23T11:00:00-08:00'),
      end: at(LA, '2026-11-23T12:00:00-08:00'),
      allDay: false,
    });
    const next = replaceSeries(moved, {
      title: 'Reading',
      start: at(LA, '2026-11-16T10:00:00-08:00'),
      end: at(LA, '2026-11-16T10:30:00-08:00'),
      allDay: false,
      rule: item.rule,
    });
    const result = expandSeries(next, window(LA, '2026-11-16T00:00:00-08:00', '2026-11-30T00:00:00-08:00'));
    expect(result.map((occurrence) => [occurrence.start.toPlainTime().toString(), occurrence.title])).toEqual([
      ['10:00:00', 'Reading'],
      ['12:00:00', 'Special'],
    ]);
  });

  it('keeps the earlier events when this and the following ones split off', () => {
    const earlier = truncateBefore(item, at(LA, '2026-11-23T09:00:00-08:00'));
    expect(earlier).not.toBeNull();
    const result = expandSeries(earlier!, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-31T00:00:00-08:00'));
    expect(days(result)).toEqual(['2026-11-16']);
    const created = seriesFromDraft(seriesId('reading'), {
      title: 'Reading',
      start: at(LA, '2026-11-23T15:00:00-08:00'),
      end: at(LA, '2026-11-23T16:00:00-08:00'),
      allDay: false,
      rule: rule({ freq: 'WEEKLY', byDay: ['MO'] }),
    });
    expect(days(expandSeries(created, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-15T00:00:00-08:00')))).toEqual([
      '2026-11-23',
      '2026-11-30',
      '2026-12-07',
      '2026-12-14',
    ]);
    expect(truncateBefore(item, item.start)).toBeNull();
  });

  it('keeps a deletion and an edit on their local time when the series start crosses a daylight-saving change', () => {
    const start = at(LA, '2026-03-02T09:00:00-08:00');
    const end = at(LA, '2026-03-02T10:00:00-08:00');
    const item = series({ start, end, rule: rule({ freq: 'WEEKLY', byDay: ['MO'] }) });
    const removed = at(LA, '2026-03-16T09:00:00-07:00');
    const editedAt = at(LA, '2026-03-23T09:00:00-07:00');
    const edited = excludeOccurrence(
      overrideOccurrence(item, editedAt, {
        title: 'Special',
        start: at(LA, '2026-03-23T11:00:00-07:00'),
        end: at(LA, '2026-03-23T12:00:00-07:00'),
        allDay: false,
      }),
      removed,
    );
    if (!edited) throw new Error('occurrences remain');
    const moved = replaceSeries(edited, {
      title: 'Stand-up',
      start: at(LA, '2026-03-09T09:00:00-07:00'),
      end: at(LA, '2026-03-09T10:00:00-07:00'),
      allDay: false,
      rule: item.rule,
    });
    const result = expandSeries(moved, window(LA, '2026-03-09T00:00:00-07:00', '2026-04-06T00:00:00-07:00'));
    expect(result.map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString(), occurrence.title])).toEqual([
      ['2026-03-09', '09:00:00', 'Stand-up'],
      ['2026-03-16', '09:00:00', 'Stand-up'],
      ['2026-03-30', '11:00:00', 'Special'],
    ]);
  });

  it('removes the series when its last occurrence is deleted', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'DAILY', end: { kind: 'count', count: 2 } }),
    });
    const once = excludeOccurrence(item, at(LA, '2026-11-16T09:00:00-08:00'));
    if (!once) throw new Error('one occurrence remains');
    expect(excludeOccurrence(once, at(LA, '2026-11-17T09:00:00-08:00'))).toBeNull();
    expect(excludeOccurrence(series({ start: item.start, end: item.end, rule: rule({ freq: 'DAILY', end: { kind: 'count', count: 1 } }) }), item.start)).toBeNull();
  });

  it('gives this and the following occurrences the remaining count, and carries the later exceptions', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['MO'], end: { kind: 'count', count: 4 } }),
    });
    const removed = at(LA, '2026-11-30T09:00:00-08:00');
    const edited = excludeOccurrence(item, removed);
    if (!edited) throw new Error('occurrences remain');
    const splitAt = at(LA, '2026-11-23T09:00:00-08:00');
    const later = continueFrom(
      edited,
      splitAt,
      {
        title: 'Later',
        start: splitAt,
        end: at(LA, '2026-11-23T10:00:00-08:00'),
        allDay: false,
        rule: item.rule,
      },
      seriesId('later'),
    );
    expect(later.rule?.end).toEqual({ kind: 'count', count: 3 });
    expect(days(expandSeries(later, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-31T00:00:00-08:00')))).toEqual(['2026-11-23', '2026-12-07']);
    const earlier = truncateBefore(edited, splitAt);
    expect(days(expandSeries(earlier!, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-31T00:00:00-08:00')))).toEqual(['2026-11-16']);
  });

  it('carries a later edit onto this and the following series, shifted with the new start', () => {
    const item = series({
      start: at(LA, '2026-11-16T09:00:00-08:00'),
      end: at(LA, '2026-11-16T10:00:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['MO'], end: { kind: 'count', count: 4 } }),
    });
    const editedAt = at(LA, '2026-11-30T09:00:00-08:00');
    const edited = overrideOccurrence(item, editedAt, {
      title: 'Special',
      start: at(LA, '2026-11-30T13:00:00-08:00'),
      end: at(LA, '2026-11-30T14:00:00-08:00'),
      allDay: false,
    });
    const splitAt = at(LA, '2026-11-23T09:00:00-08:00');
    const later = continueFrom(
      edited,
      splitAt,
      {
        title: 'Later',
        start: at(LA, '2026-11-23T11:00:00-08:00'),
        end: at(LA, '2026-11-23T12:00:00-08:00'),
        allDay: false,
        rule: item.rule,
      },
      seriesId('later'),
    );
    expect(expandSeries(later, window(LA, '2026-11-01T00:00:00-08:00', '2026-12-31T00:00:00-08:00')).map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString(), occurrence.title])).toEqual([
      ['2026-11-23', '11:00:00', 'Later'],
      ['2026-11-30', '15:00:00', 'Special'],
      ['2026-12-07', '11:00:00', 'Later'],
    ]);
  });

  it('moves a one-weekday series onto the new start weekday and refuses a start the other days leave out', () => {
    const sunday = series({
      start: at(LA, '2026-11-15T15:00:00-08:00'),
      end: at(LA, '2026-11-15T16:00:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['SU'] }),
    });
    const monday = replaceSeries(sunday, {
      title: 'Book club',
      start: at(LA, '2026-11-16T15:00:00-08:00'),
      end: at(LA, '2026-11-16T16:00:00-08:00'),
      allDay: false,
      rule: sunday.rule,
    });
    expect(monday.rule?.byDay).toEqual(['MO']);
    expect(days(expandSeries(monday, window(LA, '2026-11-15T00:00:00-08:00', '2026-11-24T00:00:00-08:00')))).toEqual(['2026-11-16', '2026-11-23']);
    expect(() =>
      replaceSeries(sunday, {
        title: 'Book club',
        start: at(LA, '2026-11-19T15:00:00-08:00'),
        end: at(LA, '2026-11-19T16:00:00-08:00'),
        allDay: false,
        rule: rule({ freq: 'WEEKLY', byDay: ['MO', 'WE'] }),
      }),
    ).toThrow(RangeError);
  });

  it('keeps the remaining count when this and following starts on a skipped hour', () => {
    const item = series({
      start: at(LA, '2026-03-01T02:30:00-08:00'),
      end: at(LA, '2026-03-01T03:30:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['SU'], end: { kind: 'count', count: 6 } }),
    });
    const range = window(LA, '2026-03-01T00:00:00-08:00', '2026-05-01T00:00:00-07:00');
    const spring = expandSeries(item, range).find((occurrence) => occurrence.start.toPlainDate().toString() === '2026-03-08');
    if (!spring) throw new Error('spring-forward occurrence');
    const later = continueFrom(
      item,
      spring.originalStart,
      { title: 'Later', start: spring.start, end: spring.end, allDay: false, rule: item.rule },
      seriesId('later'),
    );
    expect(
      expandSeries(later, range).map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString()]),
    ).toEqual([
      ['2026-03-08', '03:30:00'],
      ['2026-03-15', '02:30:00'],
      ['2026-03-22', '02:30:00'],
      ['2026-03-29', '02:30:00'],
      ['2026-04-05', '02:30:00'],
    ]);
  });

  it('keeps 2:30 when this and following leaves the start, and uses a new start when it changes', () => {
    const item = series({
      start: at(LA, '2027-03-07T02:30:00-08:00'),
      end: at(LA, '2027-03-07T03:30:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['SU'], end: { kind: 'count', count: 5 } }),
    });
    const range = window(LA, '2027-03-01T00:00:00-08:00', '2027-06-01T00:00:00-07:00');
    const before = expandSeries(item, range);
    expect(before.map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString()])).toEqual([
      ['2027-03-07', '02:30:00'],
      ['2027-03-14', '03:30:00'],
      ['2027-03-21', '02:30:00'],
      ['2027-03-28', '02:30:00'],
      ['2027-04-04', '02:30:00'],
    ]);
    const spring = before.find((occurrence) => occurrence.start.toPlainDate().toString() === '2027-03-14');
    if (!spring) throw new Error('spring-forward occurrence');
    const unchanged = continueFrom(
      item,
      spring.originalStart,
      { title: 'Later', start: spring.start, end: spring.end, allDay: false, rule: item.rule },
      seriesId('later'),
    );
    const earlier = truncateBefore(item, spring.originalStart);
    const kept = [...expandSeries(earlier!, range), ...expandSeries(unchanged, range)];
    expect(kept.map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString(), occurrence.title])).toEqual([
      ['2027-03-07', '02:30:00', 'Stand-up'],
      ['2027-03-14', '03:30:00', 'Later'],
      ['2027-03-21', '02:30:00', 'Later'],
      ['2027-03-28', '02:30:00', 'Later'],
      ['2027-04-04', '02:30:00', 'Later'],
    ]);
    const moved = continueFrom(
      item,
      spring.originalStart,
      {
        title: 'Later',
        start: at(LA, '2027-03-14T04:00:00-07:00'),
        end: at(LA, '2027-03-14T05:00:00-07:00'),
        allDay: false,
        rule: item.rule,
      },
      seriesId('moved'),
    );
    const shifted = [...expandSeries(earlier!, range), ...expandSeries(moved, range)];
    expect(shifted.map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString(), occurrence.title])).toEqual([
      ['2027-03-07', '02:30:00', 'Stand-up'],
      ['2027-03-14', '04:00:00', 'Later'],
      ['2027-03-21', '04:00:00', 'Later'],
      ['2027-03-28', '04:00:00', 'Later'],
      ['2027-04-04', '04:00:00', 'Later'],
    ]);
    const typed = continueFrom(
      item,
      spring.originalStart,
      {
        title: 'Later',
        start: at(LA, '2027-03-14T03:00:00-07:00'),
        end: at(LA, '2027-03-14T04:00:00-07:00'),
        allDay: false,
        rule: item.rule,
        startTime: Temporal.PlainTime.from('02:00'),
      },
      seriesId('typed'),
    );
    expect([...expandSeries(earlier!, range), ...expandSeries(typed, range)].map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString(), occurrence.title])).toEqual([
      ['2027-03-07', '02:30:00', 'Stand-up'],
      ['2027-03-14', '03:00:00', 'Later'],
      ['2027-03-21', '02:00:00', 'Later'],
      ['2027-03-28', '02:00:00', 'Later'],
      ['2027-04-04', '02:00:00', 'Later'],
    ]);
    const skipped = series({
      ...item,
      exdates: [at(LA, '2027-03-21T02:30:00-07:00')],
    });
    const movedExdate = continueFrom(
      skipped,
      spring.originalStart,
      {
        title: 'Later',
        start: at(LA, '2027-03-14T04:00:00-07:00'),
        end: at(LA, '2027-03-14T05:00:00-07:00'),
        allDay: false,
        rule: item.rule,
      },
      seriesId('moved-exdate'),
    );
    expect(expandSeries(movedExdate, range).map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString()])).toEqual([
      ['2027-03-14', '04:00:00'],
      ['2027-03-28', '04:00:00'],
      ['2027-04-04', '04:00:00'],
    ]);
  });

  it('keeps a lengthened occurrence on the week it spills into', () => {
    const item = series({
      start: at(LA, '2026-11-15T15:00:00-08:00'),
      end: at(LA, '2026-11-15T16:00:00-08:00'),
      rule: rule({ freq: 'WEEKLY', byDay: ['SU'] }),
    });
    const lengthened = overrideOccurrence(item, at(LA, '2026-11-22T15:00:00-08:00'), {
      title: 'Long reading',
      start: at(LA, '2026-11-21T20:00:00-08:00'),
      end: at(LA, '2026-11-22T10:00:00-08:00'),
      allDay: false,
    });
    const nextWeek = window(LA, '2026-11-22T00:00:00-08:00', '2026-11-29T00:00:00-08:00');
    expect(
      expandSeries(lengthened, viewWindow(lengthened, nextWeek)).map((occurrence) => [occurrence.start.toPlainDate().toString(), occurrence.start.toPlainTime().toString(), occurrence.title]),
    ).toEqual([['2026-11-21', '20:00:00', 'Long reading']]);
  });

  it('reports the index of a generated start and rejects a day the rule skips', () => {
    const monthly = series({
      start: at(LA, '2026-01-31T09:00:00-08:00'),
      end: at(LA, '2026-01-31T10:00:00-08:00'),
      rule: rule({ freq: 'MONTHLY' }),
    });
    expect(occurrenceIndex(monthly, at(LA, '2026-03-31T09:00:00-07:00'))).toBe(1);
    expect(occurrenceIndex(monthly, at(LA, '2026-02-28T09:00:00-08:00'))).toBeNull();
    expect(occurrenceIndex(monthly, at(LA, '2026-03-31T10:00:00-07:00'))).toBeNull();
  });
});
