import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { ButtonActionProps } from './Button.js';
import { useControlledState } from '../hooks/useControlledState.js';
import { useStrings } from '../providers/StringsProvider.js';
import type { OverlayCloseReason } from '../overlay/useControlledOpen.js';
import { SHEET_EXIT_MS } from '../overlay/useOverlayPresence.js';
import { initialFocusTarget } from '../overlay/useInitialFocus.js';
import { useSnapDrag, type SheetSnap } from '../overlay/useSnapDrag.js';
import { DialogShellRoot, ShellClose, ShellDescription, ShellTitle, type DialogShell } from './dialogShell.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { revealRing } from '../internal/revealRing.js';
import styles from './BottomSheet.module.css';

export type { SheetSnap };
/**
 * Why the sheet asked to close. `form` is a `<form method="dialog">` submit
 * (read the submitter's value from the element's `returnValue`); `native` is
 * anything else outside Todae that closed the `<dialog>` element, such as a
 * script calling `close()`. While a controlled `open` stays true, the sheet shows again.
 */
export type SheetCloseReason =
  | Extract<OverlayCloseReason, 'escape' | 'backdrop' | 'drag' | 'close-button'>
  | 'form'
  | 'native';

export type BottomSheetRootProps = {
  /** Controlled open state. Leave it out, with `defaultOpen`, for a sheet that manages its own. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: SheetCloseReason) => void;
  snap?: SheetSnap;
  defaultSnap?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  snapPoints?: readonly SheetSnap[];
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  dismissOnDrag?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'dialog'>, 'open' | 'role' | 'children'>;

// What BottomSheet adds to the modal shell: snap points, drag and the grabber.
type SheetContextValue = {
  dismissByDrag: () => void;
  bodyRef: RefObject<HTMLElement | null>;
  snap: SheetSnap;
  snapPoints: readonly SheetSnap[];
  setSnap: (snap: SheetSnap) => void;
  dismissOnDrag: boolean;
  registerGrabber: () => () => void;
};

const SheetContext = /* @__PURE__ */ createContext<SheetContextValue | null>(null);

function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('BottomSheet parts must render inside BottomSheet.Root');
  return ctx;
}

function GrabberHandle({
  'aria-label': ariaLabelProp,
  className,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { resizeSheet } = useStrings();
  const ariaLabel = ariaLabelProp || resizeSheet;
  const { snap, snapPoints, setSnap, dismissOnDrag, dismissByDrag } = useSheet();
  const resizable = snapPoints.includes('mid') && snapPoints.includes('full');

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSnap('full');
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (snap === 'full') setSnap('mid');
      else if (dismissOnDrag) dismissByDrag();
    }
  }

  return (
    <div
      {...props}
      className={cx(styles.handle, className)}
      data-todae-sheet-drag-handle=""
    >
      {/* A press toggles between the two heights, so screen reader, switch and
          touch users can resize without a drag or arrow keys. With one height
          there is nothing to resize: the pill only marks where to drag. */}
      {resizable ? (
        <button
          type="button"
          className={styles.grabber}
          aria-label={ariaLabel}
          aria-expanded={snap === 'full'}
          onClick={() => setSnap(snap === 'full' ? 'mid' : 'full')}
          onKeyDown={onKeyDown}
        >
          <span className={styles.pill} />
        </button>
      ) : (
        <span className={styles.pill} aria-hidden="true" />
      )}
    </div>
  );
}

// A placed Grabber registers with the sheet, which then drops its default one.
// Registering instead of matching the child's component type keeps this
// working when a company wraps Grabber in its own component.
function BottomSheetGrabber(props: ComponentPropsWithRef<'div'>) {
  const { registerGrabber } = useSheet();
  useLayoutEffect(registerGrabber, [registerGrabber]);
  return <GrabberHandle {...props} />;
}

function BottomSheetHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      {...props}
      className={cx(styles.header, className)}
      data-todae-sheet-drag-handle=""
    />
  );
}

function BottomSheetTitle({ className, ...props }: ComponentPropsWithRef<'h2'>) {
  return <ShellTitle {...props} className={cx(styles.title, className)} />;
}

function BottomSheetDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return <ShellDescription {...props} className={cx(styles.description, className)} />;
}

function BottomSheetBody({ className, ref, onFocus, ...props }: ComponentPropsWithRef<'div'>) {
  const { bodyRef } = useSheet();
  const refs = useComposedRefs(bodyRef as RefObject<HTMLDivElement | null>, ref);
  return (
    <div
      {...props}
      ref={refs}
      className={cx(styles.body, className)}
      onFocus={composeHandlers(onFocus, (event) => revealRing(event.currentTarget, event.target))}
    />
  );
}

function BottomSheetFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={cx(styles.footer, className)} />;
}

function BottomSheetClose(props: ButtonActionProps) {
  return <ShellClose {...props} />;
}

const DEFAULT_SNAP_POINTS: readonly SheetSnap[] = ['mid', 'full'];

// Built by a call, so bundlers can drop it with BottomSheet: esbuild keeps a top-level object that reads `styles`.
// The sheet is its own panel and leaves the page while closed.
const sheetShell = (): DialogShell => ({
  className: styles.sheet,
  panel: false,
  keepMounted: false,
  exitMs: SHEET_EXIT_MS,
  exitProperty: 'bottom',
});
const SHEET_SHELL = /* @__PURE__ */ sheetShell();

function BottomSheetRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  snap,
  defaultSnap = 'mid',
  onSnapChange,
  snapPoints,
  dismissOnDrag = true,
  initialFocusRef,
  children,
  ref,
  ...props
}: BottomSheetRootProps) {
  const points = snapPoints ?? DEFAULT_SNAP_POINTS;
  const [currentSnap, setSnap] = useControlledState<SheetSnap>(
    snap,
    points.includes(defaultSnap) ? defaultSnap : (points[0] ?? 'mid'),
    onSnapChange,
  );
  // Held here, not only in the shell, because a drag closes the sheet too and
  // drag follows the open state.
  const [open, onOpenChange] = useControlledState<boolean, [reason: SheetCloseReason]>(
    openProp,
    defaultOpen,
    onOpenChangeProp,
  );
  const dismissByDrag = useCallback(() => {
    if (open) onOpenChange(false, 'drag');
  }, [open, onOpenChange]);
  const sheetRef = useRef<HTMLDialogElement>(null);
  // The shell renders the <dialog> a commit after open, and re-renders only
  // itself. Holding the node in state renders this root again then, so
  // useSnapDrag finds the sheet and attaches its listeners.
  const [, setSheetNode] = useState<HTMLDialogElement | null>(null);
  const setSheetRef = useCallback((node: HTMLDialogElement | null) => {
    sheetRef.current = node;
    setSheetNode(node);
  }, []);
  const sheetRefs = useComposedRefs(setSheetRef, ref);
  const bodyRef = useRef<HTMLElement | null>(null);
  const [grabbers, setGrabbers] = useState(0);
  const registerGrabber = useCallback(() => {
    setGrabbers((n) => n + 1);
    return () => setGrabbers((n) => n - 1);
  }, []);

  // A placed Grabber replaces the default one a commit after mount. If the
  // default one had focus, focus went with it; give it to the sheet again.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (grabbers === 0 || !el?.open) return;
    const active = el.ownerDocument.activeElement;
    if (active && active !== el.ownerDocument.body) return;
    initialFocusTarget(el, initialFocusRef).focus();
  }, [grabbers, initialFocusRef]);
  useSnapDrag({
    sheetRef,
    bodyRef,
    snap: currentSnap,
    snapPoints: points,
    onSnap: setSnap,
    onDismiss: dismissByDrag,
    enabled: open,
    dismissOnDrag,
  });

  const ctx = useMemo<SheetContextValue>(
    () => ({
      dismissByDrag,
      bodyRef,
      snap: currentSnap,
      snapPoints: points,
      setSnap,
      dismissOnDrag,
      registerGrabber,
    }),
    [currentSnap, dismissByDrag, dismissOnDrag, points, registerGrabber, setSnap],
  );

  return (
    <SheetContext.Provider value={ctx}>
      <DialogShellRoot
        {...props}
        shell={SHEET_SHELL}
        open={open}
        onOpenChange={onOpenChange}
        initialFocusRef={initialFocusRef}
        ref={sheetRefs}
        data-snap={currentSnap}
      >
        {grabbers > 0 ? null : <GrabberHandle />}
        {children}
      </DialogShellRoot>
    </SheetContext.Provider>
  );
}

export const BottomSheet = {
  Root: BottomSheetRoot,
  Grabber: BottomSheetGrabber,
  Header: BottomSheetHeader,
  Title: BottomSheetTitle,
  Description: BottomSheetDescription,
  Body: BottomSheetBody,
  Footer: BottomSheetFooter,
  Close: BottomSheetClose,
} as const;
