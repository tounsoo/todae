import { describe, expect, it, vi } from 'vitest';
import { resetWarnOnce } from '../components/warnOnce.js';
import { defineMentionSource } from './source.js';

describe('defineMentionSource', () => {
  it('returns the same object', () => {
    const source = { char: '@', options: [] as const };
    expect(defineMentionSource(source)).toBe(source);
  });

  it('warns in development when char is more than one character', () => {
    resetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    defineMentionSource({ char: '@@', options: [] });
    expect(warn).toHaveBeenCalledTimes(1);
    defineMentionSource({ char: '@@', options: [] });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
