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
