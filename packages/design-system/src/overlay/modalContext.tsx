import { createContext, useContext, type ReactNode } from 'react';
import { ToolbarContext } from '../components/toolbarContext.js';

// Whether the modal surface around a part is mounted, including its exit motion.
const ModalPresentContext = /* @__PURE__ */ createContext<boolean | undefined>(undefined);

/** Whether the modal surface (Dialog, Drawer, BottomSheet) around this part is present, or undefined outside one. */
export function useModalPresent(): boolean | undefined {
  return useContext(ModalPresentContext);
}

/** Wraps a modal surface's children: shares its presence with them, and keeps a Toolbar around the surface from reaching in. */
export function ModalChildren({ present, children }: { present: boolean; children: ReactNode }) {
  return (
    <ModalPresentContext.Provider value={present}>
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </ModalPresentContext.Provider>
  );
}
