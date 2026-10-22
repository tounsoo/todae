import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

/** The calls an overlay surface's content adds with useSurfaceClosed. */
export type SurfaceListeners = Set<() => void>;

const SurfaceClosedContext = /* @__PURE__ */ createContext<SurfaceListeners | undefined>(undefined);

/**
 * Calls `onClosed` once each time the overlay surface around this part
 * (Dialog, Drawer, BottomSheet or Popover) finishes closing, and never
 * outside one. A part that unmounts or hides before then is not told.
 */
export function useSurfaceClosed(onClosed: () => void): void {
  const listeners = useContext(SurfaceClosedContext);
  const latest = useRef(onClosed);
  useLayoutEffect(() => {
    latest.current = onClosed;
  });
  useLayoutEffect(() => {
    if (!listeners) return;
    const listener = () => latest.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listeners]);
}

/**
 * An overlay surface's side of useSurfaceClosed: the listeners to pass to
 * SurfaceChildren, and the call that tells them the surface finished
 * closing. The surface makes it as its exit ends, while its content is still
 * mounted, never as it unmounts, which can cut an exit short.
 */
export function useSurfaceClosedSignal(): [listeners: SurfaceListeners, closed: () => void] {
  const [listeners] = useState<SurfaceListeners>(() => new Set());
  const closed = useCallback(() => {
    for (const listener of [...listeners]) listener();
  }, [listeners]);
  return [listeners, closed];
}

/** Wraps an overlay surface's children: lets them hear when it finishes closing, and keeps a Toolbar around the surface from reaching in. */
export function SurfaceChildren({ listeners, children }: { listeners: SurfaceListeners; children: ReactNode }) {
  return (
    <SurfaceClosedContext.Provider value={listeners}>
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </SurfaceClosedContext.Provider>
  );
}
