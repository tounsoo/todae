import type { ReactNode } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { Button } from './Button.js';
import { CrossGlyph, glyphOr } from './glyphs.js';

/** What a close part shows with no content of its own: the close glyph as an icon, so the button is icon-only. */
export function useCloseGlyph(): ReactNode {
  const { close } = useGlyphs();
  return <Button.Icon>{glyphOr(close, <CrossGlyph />)}</Button.Icon>;
}
