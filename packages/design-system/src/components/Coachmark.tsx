import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { useDomId } from '../internal/domId.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { anchoredContentStyle } from '../overlay/anchorName.js';
import { useCoachmark, type CoachmarkCloseReason } from '../overlay/coachmark.js';
import { usePopoverSync } from '../overlay/usePopoverSync.js';
import { warnOnce } from '../internal/warnOnce.js';
import { useStrings } from '../providers/StringsProvider.js';
import type { ButtonActionProps } from './Button.js';
import { CloseButton } from './closeButton.js';
import { PopoverSurface, type PopoverChrome } from './Popover.js';
import { Stack, type StackRootProps } from './Stack.js';
import { Text, type TextRootProps } from './Text.js';
import styles from './Coachmark.module.css';

export type { CoachmarkCloseReason };

export type CoachmarkRootProps = {
  /** Controlled open state. Leave it out, with `defaultOpen`, for a coachmark that manages its own. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: CoachmarkCloseReason) => void;
  /**
   * The element to highlight. It stays usable through the hole in the dim
   * page, and the popup sits beside it.
   */
  targetRef: RefObject<HTMLElement | null>;
  /** Defaults to `true`. */
  dismissOnEscape?: boolean;
  /** Whether a press on the dim page asks to close. Defaults to `false`, so a stray press doesn't end a tour. */
  dismissOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** The popup's name when it has no `Coachmark.Title`. */
  'aria-label'?: string;
  /** Whether arrows show at the popup's cut-off edges, as on Popover.Root. On by default. */
  arrows?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<'div'>, 'popover' | 'role' | 'children' | 'aria-label' | 'id'>;

type CoachmarkContextValue = {
  requestClose: (reason: CoachmarkCloseReason) => void;
  setLabelledBy: (id: string | undefined) => void;
  setDescribedBy: (id: string | undefined) => void;
};

const CoachmarkContext = /* @__PURE__ */ createContext<CoachmarkContextValue | null>(null);

function useCoachmarkContext(): CoachmarkContextValue {
  const ctx = useContext(CoachmarkContext);
  if (!ctx) throw new Error('Coachmark parts must render inside Coachmark.Root');
  return ctx;
}

/** The dim page with a hole over the target. Shown before the popup, so the popup sits in front. */
function Scrim({ open, anchorName, scrimRef }: { open: boolean; anchorName: string; scrimRef: RefObject<HTMLElement | null> }) {
  usePopoverSync(scrimRef, open, {});
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrimRef.current = node;
    },
    [scrimRef],
  );
  return (
    <div
      ref={setRef}
      popover="manual"
      aria-hidden="true"
      className={styles.scrim}
      style={{ positionAnchor: anchorName } as CSSProperties}
    />
  );
}

function CoachmarkRoot({
  open: openProp,
  defaultOpen,
  onOpenChange,
  targetRef,
  dismissOnEscape = true,
  dismissOnBackdrop = false,
  initialFocusRef,
  restoreFocusRef,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  arrows,
  className,
  style,
  ref,
  onPointerDown,
  onClick,
  children,
  ...props
}: CoachmarkRootProps) {
  const { open, requestClose, popupId, anchorName, popupRef, scrimRef } = useCoachmark({
    open: openProp,
    defaultOpen,
    onOpenChange,
    targetRef,
    dismissOnEscape,
    dismissOnBackdrop,
    initialFocusRef,
    restoreFocusRef,
  });
  const [labelledBy, setLabelledBy] = useState<string | undefined>();
  const [describedBy, setDescribedBy] = useState<string | undefined>();
  const refs = useComposedRefs<HTMLElement>(popupRef, ref as Ref<HTMLElement> | undefined);
  const ctx = useMemo<CoachmarkContextValue>(() => ({ requestClose, setLabelledBy, setDescribedBy }), [requestClose]);
  const name = ariaLabelledby ?? labelledBy;
  // role="dialog" takes a name; the type asks for one, and a coachmark with no
  // title and no aria-label is named by nothing.
  const chrome = { role: 'dialog', 'aria-label': ariaLabel, 'aria-labelledby': name } as PopoverChrome;
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !open) return;
    const popup = popupRef.current;
    // The title's own mark, since it names the popup a render after it mounts.
    if (popup && !ariaLabel && !ariaLabelledby && !popup.querySelector('[data-todae-coachmark-title]')) {
      warnOnce('coachmark-name', 'Todae: Coachmark.Root has no name. Render Coachmark.Title, or pass aria-label.');
    }
  });
  return (
    <CoachmarkContext.Provider value={ctx}>
      <Scrim open={open} anchorName={anchorName} scrimRef={scrimRef} />
      <PopoverSurface
        {...props}
        {...chrome}
        id={popupId}
        open={open}
        ref={refs}
        arrows={arrows}
        aria-describedby={ariaDescribedby ?? describedBy}
        className={cx(styles.popup, className)}
        style={{ ...anchoredContentStyle('--todae-popover-anchor', anchorName), ...style }}
        onPointerDown={(event: PointerEvent<HTMLElement>) => onPointerDown?.(event as PointerEvent<HTMLDivElement>)}
        onClick={(event: MouseEvent<HTMLElement>) => onClick?.(event as MouseEvent<HTMLDivElement>)}
      >
        <Stack.Root gap="condensed">{children}</Stack.Root>
      </PopoverSurface>
    </CoachmarkContext.Provider>
  );
}

/** Registers `id` as the popup's name or description while it is mounted. */
function useRegisteredId(idProp: string | undefined, register: (id: string | undefined) => void): string {
  const uid = useDomId();
  const id = idProp ?? uid;
  useLayoutEffect(() => {
    register(id);
    return () => register(undefined);
  }, [id, register]);
  return id;
}

function CoachmarkTitle({ id, ...props }: Omit<TextRootProps, 'as'>) {
  const { setLabelledBy } = useCoachmarkContext();
  return <Text.Root weight="bold" {...props} as="p" id={useRegisteredId(id, setLabelledBy)} data-todae-coachmark-title="" />;
}

function CoachmarkDescription({ id, ...props }: Omit<TextRootProps, 'as'>) {
  const { setDescribedBy } = useCoachmarkContext();
  return <Text.Root {...props} as="p" id={useRegisteredId(id, setDescribedBy)} />;
}

function CoachmarkFooter(props: Omit<StackRootProps, 'direction'>) {
  return <Stack.Root gap="condensed" justify="end" wrap {...props} direction="row" />;
}

function CoachmarkClose({ onClick, ...props }: ButtonActionProps) {
  const { requestClose } = useCoachmarkContext();
  return (
    <CloseButton
      {...props}
      fallbackName={useStrings().close}
      data-todae-close=""
      onClick={composeHandlers(onClick, () => requestClose('close-button'))}
    />
  );
}

export const Coachmark = {
  Root: CoachmarkRoot,
  Title: CoachmarkTitle,
  Description: CoachmarkDescription,
  Footer: CoachmarkFooter,
  Close: CoachmarkClose,
} as const;
