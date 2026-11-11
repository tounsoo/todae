import { brandTile } from '../../lib/og/brandTile';

export const dynamic = 'force-static';

/**
 * /favicon.ico, which browsers and crawlers ask for without reading the page's
 * icon links: the 32px PNG favicon in an ICO file, which may hold a PNG as is.
 */
export async function GET() {
  const tile = brandTile(32, 6);
  const png = new Uint8Array(await tile.arrayBuffer());
  const header = new DataView(new ArrayBuffer(22));
  header.setUint16(2, 1, true); // An icon, not a cursor.
  header.setUint16(4, 1, true); // One image.
  header.setUint8(6, 32); // Width.
  header.setUint8(7, 32); // Height.
  header.setUint16(10, 1, true); // Color planes.
  header.setUint16(12, 32, true); // Bits per pixel.
  header.setUint32(14, png.byteLength, true);
  header.setUint32(18, 22, true); // The PNG starts right after this header.
  const ico = new Uint8Array(22 + png.byteLength);
  ico.set(new Uint8Array(header.buffer));
  ico.set(png, 22);
  return new Response(ico, { headers: { 'content-type': 'image/x-icon', 'cache-control': tile.headers.get('cache-control') ?? 'public, max-age=0, must-revalidate' } });
}
