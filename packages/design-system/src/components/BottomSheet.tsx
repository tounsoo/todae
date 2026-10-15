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
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useDomId } from './domId';
import { Button, type ButtonActionProps } from './Button';
import { useControlledValue } from '../hooks/useControlledState';
import { useStrings } from '../providers/StringsProvider';
import { useDismissLabel } from './dismissLabel';
import { useCloseGlyph } from './closeGlyph';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen';
import { SHEET_EXIT_MS, useEntered, useOverlayPresence } from '../overlay/useOverlayPresence';
import { useFocusRestore } from '../overlay/useFocusRestore';
import { initialFocusTarget, useInitialFocus } from '../overlay/useInitialFocus';
import { useModalDialog } from '../overlay/useModalDialog';
import { useSnapDrag, type SheetSnap } from '../overlay/useSnapDrag';
import { composeHandlers, cx, useComposedRefs } from './props';
import { revealRing } from './revealRing';
import styles from './BottomSheet.module.css';
import { ToolbarContext } from './toolbarContext';

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

type SheetContextValue = {
  requestClose: (reason: SheetCloseReason) => void;
  setLabelledBy: (id: string | undefined) => void;
  setDescribedBy: (id: string | undefined) => void;
  bodyRef: RefObject<HTMLElement | null>;
  snap: SheetSnap;
  snapPoints: readonly SheetSnap[];
  setSnap: (snap: SheetSnap) => void;
  dismissOnDrag: boolean;
  registerGrabber: () => () => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

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
  const { snap, snapPoints, setSnap, dismissOnDrag, requestClose } = useSheet();

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp' && snapPoints.includes('full')) {
      event.preventDefault();
      setSnap('full');
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (snap === 'full' && snapPoints.includes('mid')) setSnap('mid');
      else if (snap === 'mid' && dismissOnDrag) requestClose('drag');
    }
  }

  return (
    <div
      {...props}
      className={cx(styles.handle, className)}
      data-todae-sheet-drag-handle=""
    >
      <button type="button" aria-label={ariaLabel} onKeyDown={onKeyDown} />
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

function BottomSheetTitle({ className, id: idProp, children, ...props }: ComponentPropsWithRef<'h2'>) {
  const { setLabelledBy } = useSheet();
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

function BottomSheetDescription({
  className,
  id: idProp,
  children,
  ...props
}: ComponentPropsWithRef<'p'>) {
  const { setDescribedBy } = useSheet();
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

function BottomSheetClose({ 'aria-label': ariaLabel, onClick, children, ref, ...props }: ButtonActionProps) {
  const { requestClose } = useSheet();
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
      data-todae-close=""
      onClick={composeHandlers(onClick, () => requestClose('close-button'))}
    >
      {children ?? glyph}
    </Button.Root>
  );
}

const DEFAULT_SNAP_POINTS: readonly SheetSnap[] = ['mid', 'full'];


/** Whether a pointer event landed on the backdrop: on the dialog itself, outside its box. */
function onBackdrop(dialog: HTMLElement | null, event: { target: EventTarget | null; clientX: number; clientY: number }) {
  if (!dialog || event.target !== dialog) return false;
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

function BottomSheetRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  snap,
  defaultSnap = 'mid',
  onSnapChange,
  snapPoints,
  dismissOnEscape = true,
  dismissOnBackdrop = true,
  dismissOnDrag = true,
  initialFocusRef,
  restoreFocusRef,
  className,
  children,
  ref,
  onPointerDown,
  onClick,
  onSubmit,
  ...props
}: BottomSheetRootProps) {
  const points = snapPoints ?? DEFAULT_SNAP_POINTS;
  const [uncontrolled, setUncontrolled] = useState<SheetSnap>(
    points.includes(defaultSnap) ? defaultSnap : (points[0] ?? 'mid'),
  );
  const currentSnap = snap ?? uncontrolled;
  const setSnap = useCallback(
    (next: SheetSnap) => {
      if (snap == null) setUncontrolled(next);
      onSnapChange?.(next);
    },
    [onSnapChange, snap],
  );
  const [open, onOpenChange] = useControlledValue<boolean, [reason: SheetCloseReason]>(
    openProp,
    defaultOpen,
    onOpenChangeProp,
  );
  const { requestClose } = useControlledOpen<SheetCloseReason>({ open, onOpenChange });
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [sheetNode, setSheetNode] = useState<HTMLDialogElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const pressOnBackdrop = useRef(false);
  const [labelledBy, setLabelledBy] = useState<string | undefined>();
  const [describedBy, setDescribedBy] = useState<string | undefined>();
  const [grabbers, setGrabbers] = useState(0);
  const registerGrabber = useCallback(() => {
    setGrabbers((n) => n + 1);
    return () => setGrabbers((n) => n - 1);
  }, []);
  const onDismiss = useCallback(() => requestClose('drag'), [requestClose]);
  const { present, exiting } = useOverlayPresence(open, SHEET_EXIT_MS, sheetNode, 'bottom');
  const entered = useEntered(present, exiting);
  const setSheetRef = useCallback((node: HTMLDialogElement | null) => {
    sheetRef.current = node;
    setSheetNode(node);
  }, []);
  const sheetRefs = useComposedRefs(setSheetRef, ref);

  // Records the focus to return to, so it runs before showModal moves focus.
  // Keyed on present: the page behind stays inert until the element leaves
  // at the end of the exit motion, and only then can focus go back.
  useFocusRestore(present, { restoreTo: restoreFocusRef, containerRef: sheetRef, nativeReturn: true });
  // A modal <dialog> puts the sheet in the top layer, makes the rest of the
  // page inert and keeps focus inside, so no portal or focus trap is needed.
  // closedby="none" turns Escape off natively when dismissOnEscape is false.
  const closeOnFormSubmit = useModalDialog({
    dialogRef: sheetRef,
    node: sheetNode,
    present,
    open,
    dismissOnEscape,
    onOpenChange,
    requestClose,
  });
  // After showModal, which focuses the first focusable element by itself.
  useInitialFocus(sheetRef, open, initialFocusRef);
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
    onDismiss,
    enabled: open,
    dismissOnDrag,
  });

  const ctx = useMemo<SheetContextValue>(
    () => ({
      requestClose,
      setLabelledBy,
      setDescribedBy,
      bodyRef,
      snap: currentSnap,
      snapPoints: points,
      setSnap,
      dismissOnDrag,
      registerGrabber,
    }),
    [currentSnap, dismissOnDrag, points, registerGrabber, requestClose, setSnap],
  );

  if (!present) return null;

  return (
    <SheetContext.Provider value={ctx}>
      <dialog
        {...props}
        {...{ closedby: dismissOnEscape ? 'closerequest' : 'none' }}
        aria-labelledby={props['aria-labelledby'] ?? labelledBy}
        aria-describedby={props['aria-describedby'] ?? describedBy}
        tabIndex={props.tabIndex ?? -1}
        ref={sheetRefs}
        className={cx(styles.sheet, className)}
        data-snap={currentSnap}
        data-entered={entered ? '' : undefined}
        data-todae-exiting={exiting ? '' : undefined}
        onPointerDown={(event: ReactPointerEvent<HTMLDialogElement>) => {
          onPointerDown?.(event);
          // Always tracked, so a click is judged by where its own press began.
          pressOnBackdrop.current = onBackdrop(sheetRef.current, event);
        }}
        onSubmit={(event) => {
          onSubmit?.(event);
          closeOnFormSubmit(event);
        }}
        onClick={composeHandlers(onClick, (event) => {
          const fromBackdrop = pressOnBackdrop.current && onBackdrop(sheetRef.current, event);
          pressOnBackdrop.current = false;
          // Not before the enter motion starts: the sheet is still below the
          // viewport, so its box would put any tap on the backdrop.
          if (fromBackdrop && dismissOnBackdrop && open && entered) requestClose('backdrop');
        })}
      >
        {grabbers > 0 ? null : <GrabberHandle />}
        <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
      </dialog>
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
