import type { ComponentPropsWithRef } from 'react';
import type { ButtonActionProps } from './Button';
import { DIALOG_EXIT_MS } from '../overlay/useOverlayPresence';
import {
  DialogShellRoot,
  ShellClose,
  ShellDescription,
  ShellTitle,
  type DialogRootProps,
  type DialogShell,
} from './dialogShell';
import { cx } from './props';
import styles from './Dialog.module.css';

export type { DialogCloseReason, DialogRootProps } from './dialogShell';

function DialogTitle({ className, ...props }: ComponentPropsWithRef<'h2'>) {
  return <ShellTitle {...props} className={cx(styles.title, className)} />;
}

function DialogDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return <ShellDescription {...props} className={cx(styles.description, className)} />;
}

function DialogHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={cx(styles.header, className)} />;
}

function DialogBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={cx(styles.body, className)} />;
}

function DialogFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={cx(styles.footer, className)} />;
}

function DialogClose(props: ButtonActionProps) {
  return <ShellClose {...props} />;
}

const DIALOG_SHELL: DialogShell = {
  className: styles.dialog,
  panelClassName: styles.panel,
  exitMs: DIALOG_EXIT_MS,
  exitProperty: 'opacity',
};

function DialogRoot(props: DialogRootProps) {
  return <DialogShellRoot {...props} shell={DIALOG_SHELL} />;
}

export const Dialog = {
  Root: DialogRoot,
  Title: DialogTitle,
  Description: DialogDescription,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: DialogClose,
} as const;
