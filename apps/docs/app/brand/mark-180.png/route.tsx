import { brandTile } from '../../../lib/og/brandTile';

export const dynamic = 'force-static';

/** The touch icon, at the size iOS asks for a home-screen icon. */
export function GET() {
  return brandTile(180);
}
