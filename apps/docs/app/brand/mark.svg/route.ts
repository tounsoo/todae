import { faviconSvg } from '../../../lib/brand';
import { appearanceColor } from '../../../lib/og/colors';

// The docs' ink in each color scheme, so the favicon matches the header's mark.
const SVG = faviconSvg({ light: appearanceColor('fg.default', 'light'), dark: appearanceColor('fg.default', 'dark') });

export const dynamic = 'force-static';

export function GET() {
  return new Response(SVG, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=0, must-revalidate' },
  });
}
