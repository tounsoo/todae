import { describe, expect, it } from 'vitest';

describe('pinned test locale', () => {
  it('runs in UTC with an en-US default locale', () => {
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    expect(process.env.TZ).toBe('UTC');
    expect(process.env.LANG).toBe('en-US.UTF-8');
    expect(process.env.LC_ALL).toBe('en-US.UTF-8');
    expect(resolved.timeZone).toBe('UTC');
    expect(resolved.locale).toBe('en-US');
    expect(new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(Date.UTC(1970, 0, 1, 21, 30))).toBe('9:30 PM');
  });

  it('requires Korean locale data from a full ICU build', () => {
    const text = new Intl.DateTimeFormat('ko', { timeStyle: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 9, 14, 12, 41));
    const detail = `${process.version}, ICU ${process.versions.icu}, wrote ${JSON.stringify(text)}`;
    expect(text, `Korean ICU data is missing (${detail}). The suite needs Node built with full ICU.`).toContain('오후');
  });
});
