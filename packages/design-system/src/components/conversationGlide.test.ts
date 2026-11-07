import { describe, expect, it } from 'vitest';
import { GLIDE_FRAME_MS, glideStep } from './conversationGlide.js';

// Distance left after moving through `frames` frames of `ms` each.
function leftAfter(start: number, ms: number, frames: number): number {
  let left = start;
  for (let i = 0; i < frames; i++) left -= glideStep(left, ms);
  return left;
}

describe('glideStep', () => {
  it('covers the same distance in a 120Hz second as in a 60Hz one', () => {
    const at60 = leftAfter(5000, GLIDE_FRAME_MS, 6);
    const at120 = leftAfter(5000, GLIDE_FRAME_MS / 2, 12);
    expect(at120).toBeCloseTo(at60, 6);
  });

  it('covers a share of what is left each 60th of a second', () => {
    expect(glideStep(1000, GLIDE_FRAME_MS)).toBeCloseTo(180, 6);
  });

  it('keeps moving near the end, and never past it', () => {
    expect(glideStep(10, GLIDE_FRAME_MS)).toBe(4);
    expect(glideStep(2, GLIDE_FRAME_MS)).toBe(2);
  });
});
