import {
  createContext,
  useCallback,
  useContext,
  useId,
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
import { Button, type ButtonRootProps } from './Button';
import { OverlayPortal } from '../overlay/OverlayPortal';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen';
import { SHEET_EXIT_MS, useEntered, useOverlayPresence } from '../overlay/useOverlayPresence';
import { useEscapeKey } from '../overlay/useEscapeKey';
import { useFocusRestore } from '../overlay/useFocusRestore';
import { useFocusTrap } from '../overlay/useFocusTrap';
import { useInitialFocus } from '../overlay/useInitialFocus';
import { useScrollLock } from '../overlay/useScrollLock';
import { useSnapDrag, type SheetSnap } from '../overlay/useSnapDrag';
import { cx, useComposedRefs } from './props';
import styles from './BottomSheet.module.css';

export type { SheetSnap };
export type SheetCloseReason = Extract<OverlayCloseReason, 'escape' | 'scrim' | 'drag' | 'close-button'>;

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean, reason: SheetCloseReason) => void;
  snap?: SheetSnap;
  defaultSnap?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  snapPoints?: readonly SheetSnap[];
  dismissOnEscape?: boolean;
  dismissOnScrim?: boolean;
  dismissOnDrag?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'children'>;

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
  if (!ctx) throw new Error('BottomSheet parts must render inside BottomSheet');
  return ctx;
}

function GrabberHandle({
  'aria-label': ariaLabel = 'Resize sheet',
  className,
  ...props
}: ComponentPropsWithRef<'div'>) {
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
      className={[styles.handle, className].filter(Boolean).join(' ')}
      data-sheet-drag-handle=""
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
      className={[styles.header, className].filter(Boolean).join(' ')}
      data-sheet-drag-handle=""
    />
  );
}

function BottomSheetTitle({ className, id: idProp, children, ...props }: ComponentPropsWithRef<'h2'>) {
  const { setLabelledBy } = useSheet();
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

function BottomSheetDescription({
  className,
  id: idProp,
  children,
  ...props
}: ComponentPropsWithRef<'p'>) {
  const { setDescribedBy } = useSheet();
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

function BottomSheetBody({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  const { bodyRef } = useSheet();
  const refs = useComposedRefs(bodyRef as RefObject<HTMLDivElement | null>, ref);
  return (
    <div
      {...props}
      ref={refs}
      className={[styles.body, className].filter(Boolean).join(' ')}
    />
  );
}

function BottomSheetFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={[styles.footer, className].filter(Boolean).join(' ')} />;
}

function BottomSheetClose({
  'aria-label': ariaLabel = 'Close',
  onClick,
  ...props
}: ButtonRootProps) {
  const { requestClose } = useSheet();
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

export function BottomSheet({
  open,
  onOpenChange,
  snap,
  defaultSnap = 'mid',
  onSnapChange,
  snapPoints,
  dismissOnEscape = true,
  dismissOnScrim = true,
  dismissOnDrag = true,
  initialFocusRef,
  restoreFocusRef,
  className,
  children,
  ref,
  ...props
}: BottomSheetProps) {
  const points = snapPoints ?? (['mid', 'full'] as const);
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
  const { requestClose } = useControlledOpen({
    open,
    onOpenChange: onOpenChange as (open: boolean, reason: OverlayCloseReason) => void,
  });
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetNode, setSheetNode] = useState<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const [labelledBy, setLabelledBy] = useState<string | undefined>();
  const [describedBy, setDescribedBy] = useState<string | undefined>();
  const [grabbers, setGrabbers] = useState(0);
  const registerGrabber = useCallback(() => {
    setGrabbers((n) => n + 1);
    return () => setGrabbers((n) => n - 1);
  }, []);
  const onDismiss = useCallback(() => requestClose('drag'), [requestClose]);
  const onEscape = useCallback(() => requestClose('escape'), [requestClose]);
  const { present, exiting } = useOverlayPresence(open, SHEET_EXIT_MS, sheetNode, 'transform');
  const entered = useEntered(present, exiting);
  const setSheetRef = useCallback((node: HTMLDivElement | null) => {
    sheetRef.current = node;
    setSheetNode(node);
  }, []);
  const sheetRefs = useComposedRefs(setSheetRef, ref);

  useScrollLock(present);
  useFocusRestore(open, { restoreTo: restoreFocusRef, containerRef: sheetRef });
  useInitialFocus(sheetRef, open, initialFocusRef);
  useFocusTrap(sheetRef, present);
  useEscapeKey(open, dismissOnEscape, onEscape);
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
    <OverlayPortal inertOutside>
      <SheetContext.Provider value={ctx}>
        <div
          className={styles.root}
          data-entered={entered ? '' : undefined}
          data-exiting={exiting ? '' : undefined}
        >
          <div
            className={styles.scrim}
            onClick={() => {
              if (dismissOnScrim && open) requestClose('scrim');
            }}
          />
          <div
            {...props}
            aria-labelledby={props['aria-labelledby'] ?? labelledBy}
            aria-describedby={props['aria-describedby'] ?? describedBy}
            tabIndex={props.tabIndex ?? -1}
            ref={sheetRefs}
            className={cx(styles.sheet, className)}
            role="dialog"
            aria-modal="true"
            data-snap={currentSnap}
          >
            {grabbers > 0 ? null : <GrabberHandle />}
            {children}
          </div>
        </div>
      </SheetContext.Provider>
    </OverlayPortal>
  );
}

BottomSheet.Grabber = BottomSheetGrabber;
BottomSheet.Header = BottomSheetHeader;
BottomSheet.Title = BottomSheetTitle;
BottomSheet.Description = BottomSheetDescription;
BottomSheet.Body = BottomSheetBody;
BottomSheet.Footer = BottomSheetFooter;
BottomSheet.Close = BottomSheetClose;
