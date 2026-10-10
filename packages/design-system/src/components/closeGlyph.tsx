import type { ReactNode } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider';
import { Button } from './Button';
import { CrossGlyph, glyphOr } from './glyphs';

/** What a close part shows with no content of its own: the close glyph as an icon, so the button is icon-only. */
export function useCloseGlyph(): ReactNode {
  const { close } = useGlyphs();
  return <Button.Icon>{glyphOr(close, <CrossGlyph />)}</Button.Icon>;
}
