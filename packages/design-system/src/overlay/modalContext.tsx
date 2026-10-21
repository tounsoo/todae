import { createContext, useContext, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

/** A part that answers its modal's close requests before the modal does. */
export type CloseRequestHolder = {
  /** The part's element. A holder inside another's element is asked first. */
  element: () => Element | null;
  /** Answers the request and returns true, or returns false to pass it on. */
  take: () => boolean;
};

/** What a modal surface (Dialog, Drawer, BottomSheet) shares with the parts inside it. */
export type ModalContextValue = {
  /** Mounted, including the exit motion. */
  present: boolean;
  /**
   * Offers the surface's close requests (the Android back gesture and button,
   * and `requestClose()`) to `holder` until the returned function runs. The
   * innermost holder is asked first, then the next one out; the surface
   * closes only when every holder passes.
   */
  holdCloseRequests: (holder: CloseRequestHolder) => () => void;
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
