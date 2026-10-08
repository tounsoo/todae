import { SHEET_EXIT_MS } from '../overlay/useOverlayPresence';
import { DialogShellRoot, type DialogRootProps } from './Dialog';
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

function Root({ side = 'end', ...props }: DrawerRootProps) {
  return (
    <DialogShellRoot
      {...props}
      shell={{
        className: styles.drawer,
        panelClassName: styles.panel,
        exitMs: SHEET_EXIT_MS,
        attributes: { 'data-side': side },
      }}
    />
  );
}

export const Drawer = { Root } as const;
