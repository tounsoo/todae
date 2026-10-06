import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type Ref,
  type RefObject,
} from 'react';
import type { PopoverWire } from '../components/Popover.wire';
import { useEscapeKey } from '../overlay/useEscapeKey';
import { useFocusRestore } from '../overlay/useFocusRestore';
import { useInitialFocus } from '../overlay/useInitialFocus';
import { useStableComposedRef } from '../components/props';
import { useControlledState } from './useControlledState';

export type { PopoverWire };

export type PopoverCloseReason = 'escape' | 'outside' | 'trigger';

/** What the trigger opens, for `aria-haspopup`. A role-less popover around an OptionList is a listbox. */
export type PopoverHaspopup = 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';

export type PopoverTriggerUserProps = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement | null>;
};

export type PopoverTriggerWire = {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': PopoverHaspopup;
  onClick: (event: MouseEvent<HTMLElement>) => void;
};

export type UsePopoverOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: PopoverCloseReason) => void;
  anchorRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  id?: string;
  haspopup?: PopoverHaspopup;
};

export type UsePopoverResult = {
  open: boolean;
  ids: { popover: string };
  triggerRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  getTriggerProps: <P extends PopoverTriggerUserProps>(props?: P) => P & PopoverTriggerWire;
  getPopoverProps: () => PopoverWire;
};

function eventInside(el: HTMLElement | null, event: Event): boolean {
  if (!el) return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (path.includes(el)) return true;
  return event.target instanceof Node && el.contains(event.target);
}

function triggerStyle(anchorName: string): CSSProperties {
  return {
    ['--todae-popover-anchor' as string]: anchorName,
    anchorName,
  } as CSSProperties;
}

function popoverStyle(anchorName: string): CSSProperties {
  return {
    ['--todae-popover-anchor' as string]: anchorName,
    positionAnchor: anchorName,
  } as CSSProperties;
}

function stopBubble(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export function usePopover(options: UsePopoverOptions = {}): UsePopoverResult {
  return usePopoverInternal(options, true);
}

/** Not re-exported from the package index. `restoreOnOutside` false skips the outside-click focus return. */
export function usePopoverInternal(
  options: UsePopoverOptions,
  restoreOnOutside: boolean,
): UsePopoverResult {
  const {
    open: openProp,
    defaultOpen,
    onOpenChange,
    anchorRef,
    initialFocusRef,
    restoreFocusRef,
    enabled = true,
    id,
    haspopup = 'dialog',
  } = options;
  const [open, setValue] = useControlledState(openProp, defaultOpen ?? false);
  const uid = useId().replaceAll(':', '');
  const contentId = id ?? `todae-popover-${uid}`;
  const anchorName = `--todae-popover-${uid}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const outsideRestore = useRef<(() => void) | null>(null);

  const requestClose = useCallback(
    (reason: PopoverCloseReason) => {
      if (!open) return;
      setValue(false);
      onOpenChange?.(false, reason);
    },
    [onOpenChange, open, setValue],
  );

  useFocusRestore(enabled && open, { restoreTo: restoreFocusRef, containerRef: popoverRef });
  useInitialFocus(popoverRef, enabled && open, initialFocusRef);
  useEscapeKey(open, enabled, useCallback(() => requestClose('escape'), [requestClose]));

  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const prevName = el.style.getPropertyValue('anchor-name');
    const prevVar = el.style.getPropertyValue('--todae-popover-anchor');
    el.style.setProperty('anchor-name', anchorName);
    el.style.setProperty('--todae-popover-anchor', anchorName);
    return () => {
      if (prevName) el.style.setProperty('anchor-name', prevName);
      else el.style.removeProperty('anchor-name');
      if (prevVar) el.style.setProperty('--todae-popover-anchor', prevVar);
      else el.style.removeProperty('--todae-popover-anchor');
    };
  }, [anchorName, anchorRef]);

  useEffect(() => () => outsideRestore.current?.(), []);

  useEffect(() => {
    if (!open || !enabled) return;
    function onPointerDown(event: globalThis.PointerEvent) {
      if (eventInside(popoverRef.current, event)) return;
      if (eventInside(triggerRef.current, event)) return;
      if (eventInside(anchorRef?.current ?? null, event)) return;
      requestClose('outside');
      if (!restoreOnOutside) return;
      const trigger = restoreFocusRef?.current ?? triggerRef.current;
      outsideRestore.current?.();
      const finish = () => {
        document.removeEventListener('pointerup', finish, true);
        document.removeEventListener('pointercancel', finish, true);
        outsideRestore.current = null;
        if (openRef.current) return;
        const active = document.activeElement;
        if (active == null || active === document.body) trigger?.focus({ preventScroll: true });
      };
      outsideRestore.current = () => {
        document.removeEventListener('pointerup', finish, true);
        document.removeEventListener('pointercancel', finish, true);
      };
      document.addEventListener('pointerup', finish, true);
      document.addEventListener('pointercancel', finish, true);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchorRef, enabled, open, requestClose, restoreFocusRef, restoreOnOutside]);

  const setTrigger = useCallback(
    (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
    [triggerRef],
  );
  const triggerComposed = useStableComposedRef(setTrigger);

  const getTriggerProps = useCallback(
    <P extends PopoverTriggerUserProps>(props?: P): P & PopoverTriggerWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        // Stable while the caller's ref is, so the caller's ref is not
        // detached and reattached, and its cleanup kept, across renders.
        ref: triggerComposed(user.ref),
        style: { ...user.style, ...triggerStyle(anchorName) },
        'aria-expanded': open,
        'aria-controls': contentId,
        'aria-haspopup': haspopup,
        onClick: (event: MouseEvent<HTMLElement>) => {
          user.onClick?.(event);
          if (!enabled || event.defaultPrevented) return;
          if (open) requestClose('trigger');
          else {
            setValue(true);
            onOpenChange?.(true, 'trigger');
          }
        },
      };
    },
    [anchorName, contentId, enabled, haspopup, onOpenChange, open, requestClose, setValue, triggerComposed],
  );

  // Stable, so a part that composes it with its own refs is not detached and
  // reattached on every render.
  const setPopover = useCallback(
    (node: HTMLElement | null) => {
      popoverRef.current = node;
    },
    [popoverRef],
  );

  const getPopoverProps = useCallback(
    (): PopoverWire => ({
      id: contentId,
      open,
      ref: setPopover,
      style: popoverStyle(anchorName),
      onPointerDown: stopBubble,
      onClick: stopBubble,
    }),
    [anchorName, contentId, open, setPopover],
  );

  return useMemo(
    () => ({
      open,
      ids: { popover: contentId },
      triggerRef,
      popoverRef,
      getTriggerProps,
      getPopoverProps,
    }),
    [contentId, getPopoverProps, getTriggerProps, open, popoverRef, triggerRef],
  );
}
