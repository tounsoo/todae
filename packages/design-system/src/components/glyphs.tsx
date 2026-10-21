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

/** A horizontal bar, drawn where the check goes while a checkbox is mixed. */
export function DashGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M4 8h8" />
    </svg>
  );
}

/** Points up, as an ascending column reads. */
export function SortGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M8 13V3M4 7l4-4 4 4" />
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

export function ClockGlyph() {
  return (
    <svg {...svgProps}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  );
}

export function PlusGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function MinusGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M3.5 8h9" />
    </svg>
  );
}

/** Points up, toward the conversation the message goes to. */
export function SendGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </svg>
  );
}

export function StopGlyph() {
  return (
    <svg {...svgProps}>
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ErrorGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M8 3.5v5.5" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}
