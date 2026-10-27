import type { CSSProperties } from 'react';

/** Chromium rounds 12.8px initials, 2rem times 0.4, to the next pixel when an
 *  example's border box crosses a fractional device pixel. `px` moves that
 *  example back onto the side the baseline was shot on. */
export function ShotNudge({ px }: { px: 0.1 | 0.2 | 0.3 }) {
  const style: CSSProperties = { blockSize: `${px}px` };
  return <div style={style} />;
}
