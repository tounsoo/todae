import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button, type ButtonProps } from './Button';
import { useControlledOpen, type OverlayCloseReason } from '../overlay/useControlledOpen';
import { useEscapeKey } from '../overlay/useEscapeKey';
import { useFocusRestore } from '../overlay/useFocusRestore';
import { useInitialFocus } from '../overlay/useInitialFocus';
import styles from './Popover.module.css';

export type PopoverCloseReason = Extract<OverlayCloseReason, 'escape' | 'outside' | 'trigger'>;

export type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean, reason: PopoverCloseReason) => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

type PopoverContextValue = {
  open: boolean;
  contentId: string;
  anchorName: string;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  anchorRef?: RefObject<HTMLElement | null>;
  requestClose: (reason: PopoverCloseReason) => void;
  onOpenChange: (open: boolean, reason: PopoverCloseReason) => void;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopover(): PopoverContextValue {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover parts must render inside Popover');
  return ctx;
}

function supportsAnchor(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('anchor-name', '--todae-popover');
}

function isPopoverOpen(el: HTMLElement): boolean {
  try {
    if (el.matches(':popover-open')) return true;
  } catch {
    /* jsdom */
  }
  return el.hasAttribute('data-popover-open');
}

function contains(el: HTMLElement | null, target: EventTarget | null): boolean {
  return el != null && target instanceof Node && el.contains(target);
}

function pinFallback(content: HTMLElement, anchor: HTMLElement): void {
  if (supportsAnchor()) return;
  const rect = anchor.getBoundingClientRect();
  content.style.top = `${rect.bottom}px`;
  content.style.left = `${rect.left}px`;
}

function PopoverTrigger({ onClick, style, ...props }: ButtonProps) {
  const ctx = usePopover();
  return (
    <span
      ref={(node) => {
        ctx.triggerRef.current = node;
      }}
      className={styles.trigger}
      style={{ ['--todae-popover-anchor' as string]: ctx.anchorName, anchorName: ctx.anchorName }}
    >
      <Button
        {...props}
        style={style}
        aria-expanded={ctx.open}
        aria-controls={ctx.contentId}
        aria-haspopup="dialog"
        onClick={(event) => {
          onClick?.(event);
          if (ctx.open) ctx.requestClose('trigger');
          else ctx.onOpenChange(true, 'trigger');
        }}
      />
    </span>
  );
}

function PopoverContent({
  className,
  style,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ctx = usePopover();

  useLayoutEffect(() => {
    const el = ctx.contentRef.current;
    if (!el) return;
    if (ctx.open) {
      if (!isPopoverOpen(el)) el.showPopover();
      const anchor = ctx.triggerRef.current ?? ctx.anchorRef?.current;
      if (anchor) pinFallback(el, anchor);
      return;
    }
    if (isPopoverOpen(el)) el.hidePopover();
  }, [ctx.anchorRef, ctx.contentRef, ctx.open, ctx.triggerRef]);

  return (
    <div
      {...props}
      id={ctx.contentId}
      ref={(node) => {
        ctx.contentRef.current = node;
      }}
      popover="manual"
      tabIndex={-1}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={
        {
          ...style,
          ['--todae-popover-anchor' as string]: ctx.anchorName,
          positionAnchor: ctx.anchorName,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function Popover({
  open,
  onOpenChange,
  initialFocusRef,
  restoreFocusRef,
  anchorRef,
  children,
}: PopoverProps) {
  const uid = useId().replaceAll(':', '');
  const contentId = `todae-popover-${uid}`;
  const anchorName = `--todae-popover-${uid}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const { requestClose } = useControlledOpen({
    open,
    onOpenChange: onOpenChange as (open: boolean, reason: OverlayCloseReason) => void,
  });

  useFocusRestore(open, { restoreTo: restoreFocusRef, containerRef: contentRef });
  useInitialFocus(contentRef, open, initialFocusRef);
  useEscapeKey(open, true, useCallback(() => requestClose('escape'), [requestClose]));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (contains(contentRef.current, event.target)) return;
      if (contains(triggerRef.current, event.target)) return;
      if (contains(anchorRef?.current ?? null, event.target)) return;
      requestClose('outside');
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchorRef, open, requestClose]);

  const ctx = useMemo<PopoverContextValue>(
    () => ({
      open,
      contentId,
      anchorName,
      triggerRef,
      contentRef,
      anchorRef,
      requestClose,
      onOpenChange,
    }),
    [anchorName, anchorRef, contentId, onOpenChange, open, requestClose],
  );

  return <PopoverContext.Provider value={ctx}>{children}</PopoverContext.Provider>;
}

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
