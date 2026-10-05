import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useId,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button, type ButtonRootProps } from './Button';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen';
import { DIALOG_EXIT_MS, useEntered, useOverlayPresence } from '../overlay/useOverlayPresence';
import { useFocusRestore } from '../overlay/useFocusRestore';
import { useInitialFocus } from '../overlay/useInitialFocus';
import { useScrollLock } from '../overlay/useScrollLock';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Dialog.module.css';

export type DialogCloseReason = Extract<OverlayCloseReason, 'escape' | 'backdrop' | 'close-button'>;

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean, reason: DialogCloseReason) => void;
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<ComponentPropsWithRef<'dialog'>, 'open' | 'children'>;

type DialogContextValue = {
  requestClose: (reason: DialogCloseReason) => void;
  setLabelledBy: (id: string | undefined) => void;
  setDescribedBy: (id: string | undefined) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog parts must render inside Dialog');
  return ctx;
}

function DialogTitle({ className, children, id: idProp, ...props }: ComponentPropsWithRef<'h2'>) {
  const { setLabelledBy } = useDialog();
  const uid = useId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    setLabelledBy(id);
    return () => setLabelledBy(undefined);
  }, [id, setLabelledBy]);
  return (
    <h2 {...props} id={id} className={[styles.title, className].filter(Boolean).join(' ')}>
      {children}
    </h2>
  );
}

function DialogDescription({
  className,
  children,
  id: idProp,
  ...props
}: ComponentPropsWithRef<'p'>) {
  const { setDescribedBy } = useDialog();
  const uid = useId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    setDescribedBy(id);
    return () => setDescribedBy(undefined);
  }, [id, setDescribedBy]);
  return (
    <p {...props} id={id} className={[styles.description, className].filter(Boolean).join(' ')}>
      {children}
    </p>
  );
}

function DialogHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={[styles.header, className].filter(Boolean).join(' ')} />;
}

function DialogBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={[styles.body, className].filter(Boolean).join(' ')} />;
}

function DialogFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={[styles.footer, className].filter(Boolean).join(' ')} />;
}

function DialogClose({
  'aria-label': ariaLabel = 'Close',
  onClick,
  ...props
}: ButtonRootProps) {
  const { requestClose } = useDialog();
  return (
    <Button.Root
      variant="ghost"
      aria-label={ariaLabel}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        requestClose('close-button');
      }}
    />
  );
}

export function Dialog({
  open,
  onOpenChange,
  dismissOnEscape = true,
  dismissOnBackdrop = true,
  initialFocusRef,
  restoreFocusRef,
  className,
  children,
  ref,
  onPointerDown,
  onClick,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogNode, setDialogNode] = useState<HTMLDialogElement | null>(null);
  const pointerOnDialog = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const { requestClose } = useControlledOpen({
    open,
    onOpenChange: onOpenChange as (open: boolean, reason: OverlayCloseReason) => void,
  });
  const [labelledBy, setLabelledBy] = useState<string | undefined>();
  const [describedBy, setDescribedBy] = useState<string | undefined>();
  const { present, exiting } = useOverlayPresence(open, DIALOG_EXIT_MS, dialogNode, 'opacity');
  const entered = useEntered(present, exiting);
  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    setDialogNode(node);
  }, []);
  const dialogRefs = useComposedRefs(setDialogRef, ref);

  useScrollLock(present);
  useFocusRestore(open, { restoreTo: restoreFocusRef, containerRef: dialogRef });
  useInitialFocus(dialogRef, open, initialFocusRef);

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (present && !el.open) el.showModal();
    if (!present && el.open) el.close();
  }, [present]);

  const onCancel = useCallback(
    (event: Event) => {
      event.preventDefault();
      if (dismissOnEscape) requestClose('escape');
    },
    [dismissOnEscape, requestClose],
  );

  const onNativeClose = useCallback(() => {
    if (openRef.current) onOpenChange(false, 'escape');
  }, [onOpenChange]);

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    return () => {
      el.removeEventListener('cancel', onCancel);
      el.removeEventListener('close', onNativeClose);
    };
  }, [onCancel, onNativeClose]);

  return (
    <DialogContext.Provider value={{ requestClose, setLabelledBy, setDescribedBy }}>
      <dialog
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        {...props}
        ref={dialogRefs}
        className={cx(styles.dialog, className)}
        data-entered={entered ? '' : undefined}
        data-exiting={exiting ? '' : undefined}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          // Always tracked, even when the consumer prevents it, so a later click
          // is judged by where its own press started.
          pointerOnDialog.current = event.target === dialogRef.current;
        }}
        onClick={composeHandlers(onClick, (event) => {
          if (
            dismissOnBackdrop &&
            pointerOnDialog.current &&
            event.target === dialogRef.current
          ) {
            requestClose('backdrop');
          }
        })}
      >
        <div className={styles.panel} role="document">
          {children}
        </div>
      </dialog>
    </DialogContext.Provider>
  );
}

Dialog.Title = DialogTitle;
Dialog.Description = DialogDescription;
Dialog.Header = DialogHeader;
Dialog.Body = DialogBody;
Dialog.Footer = DialogFooter;
Dialog.Close = DialogClose;
