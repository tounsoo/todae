import { createContext, useContext, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

const SurfacePresentContext = /* @__PURE__ */ createContext<boolean | undefined>(undefined);

/**
 * Whether the overlay surface around this part (Dialog, Drawer, BottomSheet
 * or Popover) is present: open, or for a modal, mounted through its exit
 * motion. Undefined outside a surface.
 */
export function useSurfacePresent(): boolean | undefined {
  return useContext(SurfacePresentContext);
}

/** Wraps an overlay surface's children: shares its presence with them, and keeps a Toolbar around the surface from reaching in. */
export function SurfaceChildren({ present, children }: { present: boolean; children: ReactNode }) {
  return (
    <SurfacePresentContext.Provider value={present}>
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </SurfacePresentContext.Provider>
  );
}
