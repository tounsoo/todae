import { describe, expect, it } from 'vitest';
import { anchorTriggerStyle, mergeAnchorNames } from './anchorName';

describe('mergeAnchorNames', () => {
  it('adds a name to a list once and drops none', () => {
    expect(mergeAnchorNames(undefined, '--a')).toBe('--a');
    expect(mergeAnchorNames('none', '--a')).toBe('--a');
    expect(mergeAnchorNames('--tip', '--a')).toBe('--tip, --a');
    expect(mergeAnchorNames('--tip, --a', '--a')).toBe('--tip, --a');
  });

  it('builds a trigger style that keeps an existing anchor name', () => {
    expect(anchorTriggerStyle('--v', '--a', { anchorName: '--tip' })).toEqual({ '--v': '--a', anchorName: '--tip, --a' });
  });
});
