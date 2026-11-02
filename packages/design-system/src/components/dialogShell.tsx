import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useDomId } from '../internal/domId.js';
import type { ButtonActionProps } from './Button.js';
import { useControlledState } from '../hooks/useControlledState.js';
import { useStrings } from '../providers/StringsProvider.js';
import { CloseButton } from './closeButton.js';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen.js';
import { useEntered, useOverlayPresence } from '../overlay/useOverlayPresence.js';
import { useFocusRestore } from '../overlay/useFocusRestore.js';
import { useInitialFocus } from '../overlay/useInitialFocus.js';
import { SurfaceChildren, useSurfaceClosedSignal } from '../overlay/surfaceContext.js';
import { useModalDialog } from '../overlay/useModalDialog.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { revealRing } from '../internal/revealRing.js';

// The modal machinery Dialog, Drawer and BottomSheet share. Each component
// wraps these parts with its own classes, so none styles another's parts.

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
  /**
   * `alertdialog` marks a dialog that interrupts to ask for a response, such as
   * confirming a destructive action. It changes the defaults: a backdrop click
   * no longer closes it, and on open focus goes to its first close part, such as
   * a `Dialog.Close` that says Cancel. It needs a `Dialog.Description` or an
   * `aria-describedby` for the message.
   */
  role?: 'dialog' | 'alertdialog';
  dismissOnEscape?: boolean;
  /** Defaults to `true`, or `false` when `role` is `alertdialog`. */
  dismissOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<ComponentPropsWithRef<'dialog'>, 'open' | 'role' | 'children'>;

type ShellContextValue = {
  requestClose: (reason: DialogCloseReason) => void;
  setLabelledBy: (id: string | undefined) => void;
  setDescribedBy: (id: string | undefined) => void;
};

const ShellContext = /* @__PURE__ */ createContext<ShellContextValue | null>(null);

function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('Dialog, Drawer and BottomSheet parts must render inside their own Root');
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

export function ShellClose({ onClick, ...props }: ButtonActionProps) {
  const { requestClose } = useShell();
  return (
    <CloseButton
      {...props}
      fallbackName={useStrings().close}
      // Marks it for the header rule, which puts it at the end of the row, and
      // for an alert dialog's initial focus, which takes it as the safe choice.
      data-todae-close=""
      onClick={composeHandlers(onClick, () => requestClose('close-button'))}
    />
  );
}

// What each modal changes: its layout, exit fallback and attributes.
export type DialogShell = {
  className?: string;
  /**
   * True (the default) for a `<dialog>` that covers the screen as the
   * backdrop, with a panel inside that holds the content: a click that lands
   * on the `<dialog>` itself is a backdrop click. False for a `<dialog>` that
   * is the panel, as BottomSheet's is: a click outside its box is.
   */
  panel?: boolean;
  panelClassName?: string;
  /** False removes the `<dialog>` while it is closed and its exit has ended. Defaults to true. */
  keepMounted?: boolean;
  exitMs: number;
  /** The `<dialog>` element's transition that ends the exit. */
  exitProperty: string;
  attributes?: Record<`data-${string}`, string>;
};

type PointerSpot = { target: EventTarget | null; clientX: number; clientY: number };

/** Whether a pointer event landed on the backdrop: on the `<dialog>` itself, and outside its box when it is its own panel. */
function onBackdrop(dialog: HTMLDialogElement | null, event: PointerSpot, panel: boolean): boolean {
  if (!dialog || event.target !== dialog) return false;
  if (panel) return true;
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

export function DialogShellRoot({
  shell,
  open: openProp,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  role,
  dismissOnEscape = true,
  dismissOnBackdrop = role !== 'alertdialog',
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
  const pressOnBackdrop = useRef(false);
  const panel = shell.panel ?? true;
  const [open, onOpenChange] = useControlledState<boolean, [reason: DialogCloseReason]>(
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
  const [closedListeners, closed] = useSurfaceClosedSignal();
  const { present, exiting } = useOverlayPresence(open, shell.exitMs, dialogNode, shell.exitProperty, closed);
  const entered = useEntered(present, exiting);
  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    setDialogNode(node);
  }, []);
  const dialogRefs = useComposedRefs(setDialogRef, ref);

  // Records the focus to return to, before showModal moves it. Keyed on
  // present: the page behind stays inert until the exit motion ends.
  useFocusRestore(present, { restoreTo: restoreFocusRef, containerRef: dialogRef, nativeReturn: true });
  const { closeOnFormSubmit, closedby } = useModalDialog({
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

  const alertShown = role === 'alertdialog' && present && open;
  const describedByProp = props['aria-describedby'];
  const described = Boolean(describedByProp ?? describedBy);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !alertShown || described) return;
    // A Description registers in a layout effect whose update renders after
    // this effect, and that render clears the timer.
    const timer = setTimeout(() =>
      console.error('Dialog.Root role="alertdialog" requires Dialog.Description or aria-describedby'),
    );
    return () => clearTimeout(timer);
  }, [alertShown, described]);

  // Stable across renders, so a memoized part such as a Title doesn't render again with the root.
  const ctx = useMemo<ShellContextValue>(() => ({ requestClose, setLabelledBy, setDescribedBy }), [requestClose]);

  if (!present && shell.keepMounted === false) return null;

  const content = <SurfaceChildren listeners={closedListeners}>{children}</SurfaceChildren>;
  return (
    <ShellContext.Provider value={ctx}>
      <dialog
        {...props}
        role={role}
        {...{ closedby }}
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
          pressOnBackdrop.current = onBackdrop(dialogRef.current, event, panel);
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
          const fromBackdrop = pressOnBackdrop.current && onBackdrop(dialogRef.current, event, panel);
          pressOnBackdrop.current = false;
          // A <dialog> that is its own panel sits below the viewport until its
          // enter motion starts, so its box would put any tap on the backdrop.
          if (fromBackdrop && dismissOnBackdrop && (panel || entered)) requestClose('backdrop');
        })}
      >
        {panel ? (
          <div className={shell.panelClassName} role="document" ref={panelRef}>
            {content}
          </div>
        ) : (
          content
        )}
      </dialog>
    </ShellContext.Provider>
  );
}
