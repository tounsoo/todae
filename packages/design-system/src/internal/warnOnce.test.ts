import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetWarnOnce, warnOnce } from './warnOnce.js';

afterEach(resetWarnOnce);

describe('warnOnce', () => {
  it('logs a key once at its level until reset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    warnOnce('a', 'first');
    warnOnce('a', 'again');
    warnOnce('b', 'boom', 'error');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('first');
    expect(error).toHaveBeenCalledWith('boom');
    resetWarnOnce();
    warnOnce('a', 'once more');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    error.mockRestore();
  });
});
