import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

/** Whether an overlay surface's owner has it open, and whether it is present: open or, for a modal, mounted through its exit motion. */
export type Surface = { open: boolean; present: boolean };

type Listeners = Set<() => void>;

const SurfaceClosedContext = /* @__PURE__ */ createContext<Listeners | undefined>(undefined);

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

function notify(listeners: Listeners) {
  for (const listener of [...listeners]) listener();
}

/** Wraps an overlay surface's children: tells them when it finishes closing, and keeps a Toolbar around the surface from reaching in. */
export function SurfaceChildren({ open, present, children }: Surface & { children: ReactNode }) {
  const [listeners] = useState<Listeners>(() => new Set());
  // A surface that keeps its content mounted finishes closing as it stops
  // being present. One that unmounts it with the exit, as BottomSheet does,
  // never renders it absent, so its content hears at the unmount instead.
  // Layout cleanups run parent first, so the content is still listening.
  const wasPresent = useRef(present);
  const exiting = useRef(false);
  useLayoutEffect(() => {
    if (wasPresent.current && !present) notify(listeners);
    wasPresent.current = present;
    exiting.current = present && !open;
  }, [listeners, open, present]);
  useLayoutEffect(
    () => () => {
      if (exiting.current) notify(listeners);
    },
    [listeners],
  );
  return (
    <SurfaceClosedContext.Provider value={listeners}>
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </SurfaceClosedContext.Provider>
  );
}
