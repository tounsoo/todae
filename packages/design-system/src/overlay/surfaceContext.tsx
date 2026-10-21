import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

/**
 * An overlay surface (Dialog, Drawer, BottomSheet or Popover): whether its
 * owner has it open, and whether it is present, open or, for a modal,
 * mounted through its exit motion.
 */
export type Surface = { open: boolean; present: boolean };

const SurfaceContext = /* @__PURE__ */ createContext<Surface | undefined>(undefined);

/** The overlay surface around this part, or undefined outside one. */
export function useSurface(): Surface | undefined {
  return useContext(SurfaceContext);
}

/** Wraps an overlay surface's children: shares its state with them, and keeps a Toolbar around the surface from reaching in. */
export function SurfaceChildren({ open, present, children }: Surface & { children: ReactNode }) {
  const surface = useMemo(() => ({ open, present }), [open, present]);
  return (
    <SurfaceContext.Provider value={surface}>
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </SurfaceContext.Provider>
  );
}
