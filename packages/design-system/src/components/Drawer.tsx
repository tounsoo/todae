import type { ComponentPropsWithRef } from 'react';
import type { ButtonActionProps } from './Button';
import { DRAWER_EXIT_MS } from '../overlay/useOverlayPresence';
import {
  DialogShellRoot,
  ShellClose,
  ShellDescription,
  ShellTitle,
  type DialogRootProps,
  type DialogShell,
} from './dialogShell';
import { composeHandlers, cx } from './props';
import { revealRing } from './revealRing';
import styles from './Drawer.module.css';

export type DrawerSide = 'start' | 'end';

/**
 * A modal dialog pinned to the start or end edge, full height. It takes
 * `Dialog.Root`'s props, and its inside is built from Drawer's own parts.
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
  return <DialogShellRoot {...props} shell={side === 'start' ? SHELLS.start : SHELLS.end} />;
}

function Title({ className, ...props }: ComponentPropsWithRef<'h2'>) {
  return <ShellTitle {...props} className={cx(styles.title, className)} />;
}

function Description({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return <ShellDescription {...props} className={cx(styles.description, className)} />;
}

function Header({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={cx(styles.header, className)} />;
}

// The body is the drawer's scroll container, so it reveals rings cut at its own edges.
function Body({ className, onFocus, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      {...props}
      className={cx(styles.body, className)}
      onFocus={composeHandlers(onFocus, (event) => revealRing(event.currentTarget, event.target))}
    />
  );
}

function Footer({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={cx(styles.footer, className)} />;
}

function Close({ className, ...props }: ButtonActionProps) {
  return <ShellClose {...props} className={cx(styles.close, className)} />;
}

export const Drawer = { Root, Header, Title, Description, Body, Footer, Close } as const;
