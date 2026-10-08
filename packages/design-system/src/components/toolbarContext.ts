import { createContext } from 'react';

export type ToolbarOrientation = 'horizontal' | 'vertical';

type ToolbarContextValue = { orientation: ToolbarOrientation };

/**
 * Set inside a toolbar, so a control inside, such as ToggleGroup or
 * Menu.Trigger, leaves the toolbar's arrow keys to it. Layers that open from
 * a toolbar (popovers, menus, dialogs) reset it to null.
 */
export const ToolbarContext = createContext<ToolbarContextValue | null>(null);

// A layer that opens from the toolbar keeps its own keyboard model.
export const TOOLBAR_BOUNDARY = '[role="toolbar"], [popover], dialog';
