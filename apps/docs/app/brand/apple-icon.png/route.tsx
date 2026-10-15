import { ImageResponse } from 'next/og';
import { BrandMark } from '../../../lib/brand';
import { coreColor } from '../../../lib/og/colors';

/** The size iOS asks for a home-screen icon. */
const SIZE = 180;
const ink = coreColor('gray.900');
const paper = coreColor('gray.50');

export const dynamic = 'force-static';

// iOS rounds the corners itself, so the tile is square: the paper mark on ink.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: ink }}>
        <BrandMark size={128} color={paper} background={ink} />
      </div>
    ),
    { width: SIZE, height: SIZE, headers: { 'cache-control': 'public, max-age=0, must-revalidate' } },
  );
}
