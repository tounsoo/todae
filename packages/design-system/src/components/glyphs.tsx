import type { ReactNode } from 'react';

/** Whether a provider set this glyph: anything but null, undefined, a boolean or an empty string. */
export function hasGlyph(glyph: ReactNode): boolean {
  return glyph != null && typeof glyph !== 'boolean' && glyph !== '';
}

/** The glyph a provider set, else Todae's own. */
export function glyphOr(glyph: ReactNode, own: ReactNode): ReactNode {
  return hasGlyph(glyph) ? glyph : own;
}

// Todae's own glyphs, drawn where no GlyphsProvider sets one. Not exported:
// Todae ships no icon set. They take the text color and fill the box their
// part gives them, 1em when it gives none.
const svgProps = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

export function CrossGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function CheckGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/** Points down, as a chevron from GlyphsProvider should. */
export function ChevronGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function CalendarGlyph() {
  return (
    <svg {...svgProps}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  );
}
