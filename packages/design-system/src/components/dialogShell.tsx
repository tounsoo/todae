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
import { useEntered, useOverlayPresence } from '../overlay/useOverlayPresence.js';
import { useFocusRestore } from '../overlay/useFocusRestore.js';
import { useInitialFocus } from '../overlay/useInitialFocus.js';
import { useModalDialog } from '../overlay/useModalDialog.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { revealRing } from './revealRing.js';
import { ToolbarContext } from './toolbarContext.js';

// The modal machinery Dialog and Drawer share. Each component wraps these
// parts with its own classes, so neither styles the other's parts.

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

type ShellContextValue = {
  requestClose: (reason: DialogCloseReason) => void;
  setLabelledBy: (id: string | undefined) => void;
  setDescribedBy: (id: string | undefined) => void;
};

const ShellContext = /* @__PURE__ */ createContext<ShellContextValue | null>(null);

function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('Dialog and Drawer parts must render inside Dialog.Root or Drawer.Root');
  return ctx;
}

export function ShellTitle({ children, id: idProp, ...props }: ComponentPropsWithRef<'h2'>) {
  const { setLabelledBy } = useShell();
  const uid = useDomId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    setLabelledBy(id);
    return () => setLabelledBy(undefined);
  }, [id, setLabelledBy]);
  return (
    <h2 {...props} id={id}>
      {children}
    </h2>
  );
}

export function ShellDescription({ children, id: idProp, ...props }: ComponentPropsWithRef<'p'>) {
  const { setDescribedBy } = useShell();
  const uid = useDomId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    setDescribedBy(id);
    return () => setDescribedBy(undefined);
  }, [id, setDescribedBy]);
  return (
    <p {...props} id={id}>
      {children}
    </p>
  );
}

export function ShellClose({ 'aria-label': ariaLabel, onClick, children, ref, ...props }: ButtonActionProps) {
  const { requestClose } = useShell();
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
      // Marks it for the header rule, which puts it at the end of the row.
      data-todae-close=""
      onClick={composeHandlers(onClick, () => requestClose('close-button'))}
    >
      {children ?? glyph}
    </Button.Root>
  );
}

// What each modal changes: its layout classes, exit fallback and attributes.
export type DialogShell = {
  className?: string;
  panelClassName?: string;
  exitMs: number;
  /** The `<dialog>` element's transition that ends the exit. */
  exitProperty: string;
  attributes?: Record<`data-${string}`, string>;
};

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
  // Declared after useModalDialog, whose showModal runs first in the same
  // commit and focuses the first focusable element by itself. Keyed on
  // present too: opened after mount, present flips a commit after open, and
  // the <dialog> can't take focus until showModal runs.
  useInitialFocus(dialogRef, present && open, initialFocusRef);

  return (
    <ShellContext.Provider value={{ requestClose, setLabelledBy, setDescribedBy }}>
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
    </ShellContext.Provider>
  );
}
