import { describe, expect, it } from 'vitest';
import { anchorTriggerStyle, mergeAnchorNames, removeAnchorName } from './anchorName';

describe('mergeAnchorNames', () => {
  it('adds a name to a list once and drops none', () => {
    expect(mergeAnchorNames(undefined, '--a')).toBe('--a');
    expect(mergeAnchorNames('none', '--a')).toBe('--a');
    expect(mergeAnchorNames('--tip', '--a')).toBe('--tip, --a');
    expect(mergeAnchorNames('--tip, --a', '--a')).toBe('--tip, --a');
  });

  it('builds a trigger style that keeps an existing anchor name', () => {
    expect(anchorTriggerStyle('--v', '--a', { anchorName: '--tip', color: 'red' })).toEqual({
      color: 'red',
      '--v': '--a',
      anchorName: '--tip, --a',
    });
  });

  it('takes out only its own name', () => {
    expect(removeAnchorName('--a, --b', '--a')).toBe('--b');
    expect(removeAnchorName('--a', '--a')).toBe('');
    expect(removeAnchorName(undefined, '--a')).toBe('');
  });
});
