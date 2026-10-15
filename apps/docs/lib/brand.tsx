import type { SVGProps } from 'react';

/**
 * Todae's mark: a hanok, the house raised on a stone base (토대) with a step
 * up to it. Every copy of the mark draws these shapes: the header, the
 * favicon, the touch icon and the link-preview card.
 */
export const BRAND_VIEWBOX = '0 -3 96 96';

/** Four pillars with a wider middle bay, a base and a step. The roof covers the pillars' tops. */
const BLOCKS = [
  [17, 28, 4, 42],
  [33, 28, 4, 42],
  [59, 28, 4, 42],
  [75, 28, 4, 42],
  [10, 70, 76, 9],
  [40, 79, 16, 5],
] as const;

/** A tiled roof whose ridge and eaves curve along their whole length, rising to the corners. */
const ROOF = 'M3 27C22 34 74 34 93 27C86 26 80 22 77 15L79 11Q48 15 17 11L19 15C16 22 10 26 3 27Z';

/** The ridge line, cut from the roof in the background color. Too fine to draw below 26px. */
const RIDGE = 'M24 16Q48 19 72 16';
export const RIDGE_MIN_SIZE = 26;

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'> & {
  size: number;
  /** The mark's color. */
  color?: string;
  /** The background behind the mark. Given, the ridge line is cut in it at sizes that hold it. */
  background?: string;
};

/** The mark as an element, for pages and for the image renderer (which needs explicit colors). */
export function BrandMark({ size, color = 'currentColor', background, ...props }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox={BRAND_VIEWBOX} fill={color} {...props}>
      {BLOCKS.map(([x, y, width, height]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={width} height={height} />
      ))}
      <path d={ROOF} />
      {background && size >= RIDGE_MIN_SIZE && <path d={RIDGE} fill="none" stroke={background} strokeWidth={1.8} />}
    </svg>
  );
}

/** The favicon: the mark in `light` on light browser chrome and in `dark` on dark. It is drawn at 16 to 32px, so no ridge line. */
export function faviconSvg({ light, dark }: { light: string; dark: string }): string {
  const blocks = BLOCKS.map(([x, y, width, height]) => `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_VIEWBOX}">` +
    `<style>*{fill:${light}}@media (prefers-color-scheme:dark){*{fill:${dark}}}</style>` +
    `${blocks}<path d="${ROOF}"/></svg>`
  );
}
