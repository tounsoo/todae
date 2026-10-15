import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useDomId } from './domId.js';
import { Button, type ButtonActionProps } from './Button.js';
import { useControlledValue } from '../hooks/useControlledState.js';
import { useStrings } from '../providers/StringsProvider.js';
import { useDismissLabel } from './dismissLabel.js';
import { useCloseGlyph } from './closeGlyph.js';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen.js';
import { DIALOG_EXIT_MS, useEntered, useOverlayPresence } from '../overlay/useOverlayPresence.js';
import { useFocusRestore } from '../overlay/useFocusRestore.js';
import { useInitialFocus } from '../overlay/useInitialFocus.js';
import { useModalDialog } from '../overlay/useModalDialog.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { revealRing } from './revealRing.js';
import styles from './Dialog.module.css';
import { ToolbarContext } from './toolbarContext.js';

/**
 * Why the dialog asked to close. `form` is a `<form method="dialog">` submit
 * (read the submitter's value from the element's `returnValue`); `native` is
 * anything else that closed the `<dialog>` element, such as a script calling
 * `close()`.
 */
export type DialogCloseReason = Extract<OverlayCloseReason, 'escape' | 'backdrop' | 'close-button'> | 'form' | 'native';

export type DialogRootProps = {
  /** Controlled open state. Leave it out, with `defaultOpen`, for a dialog that manages its own. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: DialogCloseReason) => void;
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

const DialogContext = /* @__PURE__ */ createContext<DialogContextValue | null>(null);

function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog parts must render inside Dialog.Root');
  return ctx;
}

function DialogTitle({ className, children, id: idProp, ...props }: ComponentPropsWithRef<'h2'>) {
  const { setLabelledBy } = useDialog();
  const uid = useDomId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    setLabelledBy(id);
    return () => setLabelledBy(undefined);
  }, [id, setLabelledBy]);
  return (
    <h2 {...props} id={id} className={cx(styles.title, className)}>
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
  const uid = useDomId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    setDescribedBy(id);
    return () => setDescribedBy(undefined);
  }, [id, setDescribedBy]);
  return (
    <p {...props} id={id} className={cx(styles.description, className)}>
      {children}
    </p>
  );
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

function DialogClose({ 'aria-label': ariaLabel, onClick, children, ref, ...props }: ButtonActionProps) {
  const { requestClose } = useDialog();
  // Text a screen reader reads, such as "Cancel", names the button; the close string names one without, such as an icon.
  const [label, refs] = useDismissLabel(children, ariaLabel, ref, useStrings().close);
  const glyph = useCloseGlyph();
  return (
    <Button.Root
      variant="ghost"
      // Todae's own close shows no tip, as a text × never did: a dialog's first
      // focus often lands on it.
      tooltip={children == null ? false : undefined}
      aria-label={label}
      {...props}
      ref={refs}
      onClick={composeHandlers(onClick, () => requestClose('close-button'))}
    >
      {children ?? glyph}
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

// Built by a call, so bundlers can drop it with Dialog: esbuild keeps a top-level object that reads `styles`.
const dialogShell = (): DialogShell => ({
  className: styles.dialog,
  panelClassName: styles.panel,
  exitMs: DIALOG_EXIT_MS,
  exitProperty: 'opacity',
});
const DIALOG_SHELL = /* @__PURE__ */ dialogShell();

function DialogRoot(props: DialogRootProps) {
  return <DialogShellRoot {...props} shell={DIALOG_SHELL} />;
}

export function DialogShellRoot({
  shell,
  open: openProp,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
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
  onFocus,
  ...props
}: DialogRootProps & { shell: DialogShell }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dialogNode, setDialogNode] = useState<HTMLDialogElement | null>(null);
  const pointerOnDialog = useRef(false);
  const [open, onOpenChange] = useControlledValue<boolean, [reason: DialogCloseReason]>(
    openProp,
    defaultOpen,
    onOpenChangeProp,
  );
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
        data-todae-exiting={exiting ? '' : undefined}
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
        // On the dialog, not the panel, so the consumer's onFocus runs first
        // and can skip the reveal with preventDefault().
        onFocus={composeHandlers(onFocus, (event) => {
          if (panelRef.current) revealRing(panelRef.current, event.target);
        })}
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
        <div
          className={shell.panelClassName}
          role="document"
          ref={panelRef}
        >
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
