import { ImageResponse } from 'next/og';
import { BrandMark } from '../brand';
import { appearanceColor } from './colors';

// The docs' light ink and canvas: the mark in canvas on an ink tile reads on light and dark browser chrome alike.
const ink = appearanceColor('fg.default', 'light');
const paper = appearanceColor('bg.canvas', 'light');

/**
 * The mark on a square ink tile, as a PNG `size` pixels wide. iOS rounds a
 * touch icon's corners itself, so it passes no `radius`; a favicon does.
 */
export function brandTile(size: number, radius = 0): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: radius, background: ink }}>
        <BrandMark size={Math.round(size * 0.72)} color={paper} background={ink} />
      </div>
    ),
    // The URL has no version, so a redeploy that redraws it must not be hidden behind ImageResponse's year-long immutable default.
    { width: size, height: size, headers: { 'cache-control': 'public, max-age=0, must-revalidate' } },
  );
}
