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

const CANCEL_CLOSE_WINDOW_MS = 500;

/**
 * Why the dialog asked to close. `form` is a `<form method="dialog">` submit
 * (read the submitter's value from the element's `returnValue`); `native` is
 * anything else that closed the `<dialog>` element, such as a script calling
 * `close()`.
 */
export type DialogCloseReason = Extract<OverlayCloseReason, 'escape' | 'backdrop' | 'close-button'> | 'form' | 'native';

export type DialogRootProps = {
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
  if (!ctx) throw new Error('Dialog parts must render inside Dialog.Root');
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

function DialogRoot({
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
  onSubmit,
  ...props
}: DialogRootProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogNode, setDialogNode] = useState<HTMLDialogElement | null>(null);
  const pointerOnDialog = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const { requestClose } = useControlledOpen({
    open,
    onOpenChange,
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

  // Chrome may close on Escape even though cancel was prevented. Its close
  // event comes a task later, so a close shortly after a cancel is an Escape.
  const cancelledAt = useRef(-Infinity);
  const onCancel = useCallback(
    (event: Event) => {
      cancelledAt.current = performance.now();
      event.preventDefault();
      if (dismissOnEscape) requestClose('escape');
    },
    [dismissOnEscape, requestClose],
  );

  // Something outside Todae closed the element. Report it so the owner can
  // sync `open`; the element is already closed, so there is no exit motion.
  const onNativeClose = useCallback(() => {
    if (!openRef.current) return;
    const escaped = performance.now() - cancelledAt.current < CANCEL_CLOSE_WINDOW_MS;
    cancelledAt.current = -Infinity;
    onOpenChange(false, escaped ? 'escape' : 'native');
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
        {...props}
        aria-labelledby={props['aria-labelledby'] ?? labelledBy}
        aria-describedby={props['aria-describedby'] ?? describedBy}
        tabIndex={props.tabIndex ?? -1}
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
        onSubmit={(event) => {
          onSubmit?.(event);
          // A form inside that already prevented its submit keeps the dialog open, as natively.
          if (event.defaultPrevented) return;
          const native = event.nativeEvent as SubmitEvent;
          const form = event.target as HTMLFormElement;
          const submitter = native.submitter as HTMLButtonElement | HTMLInputElement | null;
          const method = submitter?.getAttribute('formmethod') ?? form.getAttribute('method') ?? '';
          // Natively the form closes its own nearest <dialog>, so a form portaled
          // out of this element (still inside it in the React tree) is not ours.
          if (method.toLowerCase() !== 'dialog' || form.closest('dialog') !== dialogRef.current) return;
          // Close through onOpenChange instead of letting the browser close the
          // element: the owner stays in control of `open`, and the exit motion runs.
          event.preventDefault();
          const dialog = dialogRef.current;
          // Natively a submit without a submitter leaves returnValue as it was.
          if (dialog && submitter) dialog.returnValue = submitter.value;
          requestClose('form');
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

export const Dialog = {
  Root: DialogRoot,
  Title: DialogTitle,
  Description: DialogDescription,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: DialogClose,
} as const;
