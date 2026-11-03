import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { PRESET_PAIRS, contrastFailures } from './presets.contrast';

describe('preset contrast', () => {
  it('keeps every preset indicator pair at the contract minimum in light and dark', () => {
    const { count, lines } = contrastFailures();
    expect(count).toBe(PRESETS.length * 2 * PRESET_PAIRS.length);
    expect(lines, lines.join('\n')).toEqual([]);
  });
});
