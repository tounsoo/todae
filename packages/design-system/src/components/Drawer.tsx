import { DRAWER_EXIT_MS } from '../overlay/useOverlayPresence';
import { DialogShellRoot, type DialogRootProps, type DialogShell } from './Dialog';
import styles from './Drawer.module.css';

export type DrawerSide = 'start' | 'end';

/**
 * A modal dialog pinned to the start or end edge, full height. It is a
 * `Dialog.Root` in every other way: build the inside from Dialog's parts.
 */
export type DrawerRootProps = DialogRootProps & {
  /** The inline edge it is pinned to. Start and end follow text direction. */
  side?: DrawerSide;
};

// The scrim fades by its color, not the element's opacity, so the panel's
// slide stays visible to the end.
const shellFor = (side: DrawerSide): DialogShell => ({
  className: styles.drawer,
  panelClassName: styles.panel,
  exitMs: DRAWER_EXIT_MS,
  exitProperty: 'background-color',
  attributes: { 'data-side': side },
});
const SHELLS = { start: shellFor('start'), end: shellFor('end') } as const;

function Root({ side = 'end', ...props }: DrawerRootProps) {
  return <DialogShellRoot {...props} shell={SHELLS[side]} />;
}

export const Drawer = { Root } as const;
