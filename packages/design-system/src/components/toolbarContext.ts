import { createContext, useContext, useLayoutEffect, useState, type RefObject } from 'react';

export type ToolbarOrientation = 'horizontal' | 'vertical';

type ToolbarContextValue = { orientation: ToolbarOrientation };

/**
 * Set inside a toolbar, so a control inside, such as ToggleGroup or
 * Menu.Trigger, leaves the toolbar's arrow keys to it. Layers that open from
 * a toolbar (popovers, menus, dialogs) reset it to null. Read it with
 * useToolbar, which also checks the DOM.
 */
export const ToolbarContext = createContext<ToolbarContextValue | null>(null);

// A layer that opens from the toolbar keeps its own keyboard model.
export const TOOLBAR_BOUNDARY = '[role="toolbar"], [popover], dialog';

/**
 * The toolbar that manages `node`, or null. Context still crosses a plain
 * portal, but the toolbar only manages controls inside its own element, so
 * the DOM is checked once mounted.
 */
export function useToolbar(nodeRef: RefObject<HTMLElement | null>): ToolbarContextValue | null {
  const context = useContext(ToolbarContext);
  const [outside, setOutside] = useState(false);
  useLayoutEffect(() => {
    if (!context) return;
    const layer = nodeRef.current?.parentElement?.closest(TOOLBAR_BOUNDARY);
    setOutside(layer?.getAttribute('role') !== 'toolbar');
  }, [context, nodeRef]);
  return outside ? null : context;
}
