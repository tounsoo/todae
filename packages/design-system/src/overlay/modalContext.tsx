import { createContext, useContext, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

/** What a modal surface (Dialog, Drawer, BottomSheet) shares with the parts inside it. */
export type ModalContextValue = {
  /** Mounted, including the exit motion. */
  present: boolean;
  /**
   * Takes the surface's close requests (Escape, and the Android back gesture
   * and button) ahead of it until the returned function runs. The handler
   * registered last gets them, and the surface stays open.
   */
  holdCloseRequests: (handler: () => void) => () => void;
};

export const ModalContext = /* @__PURE__ */ createContext<ModalContextValue | null>(null);

/** The modal surface around this part, or null outside one. */
export function useModalContext(): ModalContextValue | null {
  return useContext(ModalContext);
}

/** Wraps a modal surface's children: shares the surface with them, and keeps a Toolbar around the surface from reaching in. */
export function ModalChildren({ modal, children }: { modal: ModalContextValue; children: ReactNode }) {
  return (
    <ModalContext.Provider value={modal}>
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </ModalContext.Provider>
  );
}
