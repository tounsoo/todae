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
});
