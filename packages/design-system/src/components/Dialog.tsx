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
import { Button, type ButtonActionProps } from './Button';
import { useDismissLabel } from './dismissLabel';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen';
import { DIALOG_EXIT_MS, useEntered, useOverlayPresence } from '../overlay/useOverlayPresence';
import { useFocusRestore } from '../overlay/useFocusRestore';
import { useInitialFocus } from '../overlay/useInitialFocus';
import { useModalDialog } from '../overlay/useModalDialog';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Dialog.module.css';
import { ToolbarContext } from './toolbarContext';

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

function DialogClose({ 'aria-label': ariaLabel, onClick, children, ref, ...props }: ButtonActionProps) {
  const { requestClose } = useDialog();
  // Visible text such as "Cancel" names the button; "Close" only names one without words.
  const [label, refs] = useDismissLabel(children, ariaLabel, ref, 'Close');
  return (
    <Button.Root
      variant="ghost"
      aria-label={label}
      {...props}
      ref={refs}
      onClick={(event) => {
        onClick?.(event);
        requestClose('close-button');
      }}
    >
      {children}
    </Button.Root>
  );
}

// What a modal built on Dialog's machinery changes: Drawer passes its own
// layout classes, exit fallback and side.
export type DialogShell = {
  className?: string;
  panelClassName?: string;
  exitMs: number;
  /** The `<dialog>` element's transition that ends the exit. */
  exitProperty: string;
  attributes?: Record<`data-${string}`, string>;
};

const DIALOG_SHELL: DialogShell = {
  className: styles.dialog,
  panelClassName: styles.panel,
  exitMs: DIALOG_EXIT_MS,
  exitProperty: 'opacity',
};

function DialogRoot(props: DialogRootProps) {
  return <DialogShellRoot {...props} shell={DIALOG_SHELL} />;
}

export function DialogShellRoot({
  shell,
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
}: DialogRootProps & { shell: DialogShell }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogNode, setDialogNode] = useState<HTMLDialogElement | null>(null);
  const pointerOnDialog = useRef(false);
  const { requestClose } = useControlledOpen({
    open,
    onOpenChange,
  });
  const [labelledBy, setLabelledBy] = useState<string | undefined>();
  const [describedBy, setDescribedBy] = useState<string | undefined>();
  const { present, exiting } = useOverlayPresence(open, shell.exitMs, dialogNode, shell.exitProperty);
  const entered = useEntered(present, exiting);
  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    setDialogNode(node);
  }, []);
  const dialogRefs = useComposedRefs(setDialogRef, ref);

  // Records the focus to return to, before showModal moves it. Keyed on
  // present: the page behind stays inert until the exit motion ends.
  useFocusRestore(present, { restoreTo: restoreFocusRef, containerRef: dialogRef, nativeReturn: true });
  const closeOnFormSubmit = useModalDialog({
    dialogRef,
    node: dialogNode,
    present,
    open,
    dismissOnEscape,
    onOpenChange,
    requestClose,
  });
  // After showModal, which focuses the first focusable element by itself.
  useInitialFocus(dialogRef, open, initialFocusRef);

  return (
    <DialogContext.Provider value={{ requestClose, setLabelledBy, setDescribedBy }}>
      <dialog
        {...props}
        {...{ closedby: dismissOnEscape ? 'closerequest' : 'none' }}
        aria-labelledby={props['aria-labelledby'] ?? labelledBy}
        aria-describedby={props['aria-describedby'] ?? describedBy}
        tabIndex={props.tabIndex ?? -1}
        {...shell.attributes}
        ref={dialogRefs}
        className={cx(shell.className, className)}
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
          closeOnFormSubmit(event);
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
        <div className={shell.panelClassName} role="document">
          <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
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
