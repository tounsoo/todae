'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Glyphs } from './glyphs.js';

export type { Glyphs } from './glyphs.js';

export type GlyphsProviderProps = {
  /** The glyphs to change. Each key left out comes from the nearest GlyphsProvider above; null brings back Todae's own. */
  glyphs: Glyphs;
  children?: ReactNode;
};

const NO_GLYPHS: Readonly<Glyphs> = /* @__PURE__ */ Object.freeze({});

const GlyphsContext = /* @__PURE__ */ createContext<Readonly<Glyphs>>(NO_GLYPHS);

/** Sets the glyphs Todae draws by itself, such as close crosses and check marks, for its subtree. Renders no element. */
export function GlyphsProvider({ glyphs, children }: GlyphsProviderProps) {
  const parent = useContext(GlyphsContext);
  const value = useMemo(() => {
    const merged: Glyphs = { ...parent };
    for (const key of Object.keys(glyphs) as (keyof Glyphs)[]) {
      // A key set to undefined keeps the parent's glyph; null resets it.
      if (glyphs[key] !== undefined) merged[key] = glyphs[key];
    }
    return merged;
  }, [parent, glyphs]);
  return <GlyphsContext.Provider value={value}>{children}</GlyphsContext.Provider>;
}

/** The glyphs in effect here: the nearest GlyphsProvider's, merged over its parents'. An unset or null key means Todae's own. */
export function useGlyphs(): Readonly<Glyphs> {
  return useContext(GlyphsContext);
}
