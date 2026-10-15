import { brandTile } from '../../../lib/og/brandTile';

export const dynamic = 'force-static';

/** The favicon for browsers that don't draw SVG icons, such as Safari before 26. */
export function GET() {
  return brandTile(32, 6);
}
