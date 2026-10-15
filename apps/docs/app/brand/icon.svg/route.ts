import { faviconSvg } from '../../../lib/brand';
import { coreColor } from '../../../lib/og/colors';

// The docs' light and dark ink, as the site resolves color.fg.default.
const SVG = faviconSvg({ light: coreColor('gray.900'), dark: coreColor('gray.100') });

export const dynamic = 'force-static';

export function GET() {
  return new Response(SVG, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=0, must-revalidate' },
  });
}
